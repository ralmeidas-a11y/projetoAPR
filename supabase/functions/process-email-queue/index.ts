import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Get highly critical system role service key if needed, or use RPC for atomic row locks.
    // For simplicity, we use the postgres function we will create to atomicly pop messages.
    // Actually, since this is edge function, we can execute an RPC call `process_email_queue()`
    // Here we query pending emails directly for simplicity without RPC, relying on the fact this might run on a cron.
    // However, locking is requested. "Use database locking strategies."

    // We will call an RPC "get_and_lock_email_batch" defined in our migration
    const { data: emails, error: lockError } = await supabaseClient.rpc(
      "get_and_lock_email_batch",
      { batch_size: 10 },
    );

    if (lockError) throw lockError;

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ message: "No pending emails" }), {
        status: 200,
      });
    }

    console.log(`Processing ${emails.length} emails...`);

    for (const email of emails) {
      try {
        console.log(
          `Sending email to ${email.recipient_email} (ID: ${email.id})`,
        );

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Sistema <onboarding@resend.dev>",
            to: email.recipient_email,
            subject: email.subject,
            html: email.html_content,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          console.log(`Success sending ${email.id}`);
          await supabaseClient
            .from("email_queue")
            .update({ status: "sent", last_error: null })
            .eq("id", email.id);
        } else {
          console.log(`Resend API error for ${email.id}:`, data);
          throw new Error(JSON.stringify(data));
        }
      } catch (err) {
        console.error(`Failed to send email ${email.id}:`, err);
        const attempt_count = email.attempt_count + 1;
        const status = attempt_count >= 3 ? "failed" : "pending";

        await supabaseClient
          .from("email_queue")
          .update({
            status,
            attempt_count,
            last_error: err.message,
          })
          .eq("id", email.id);
      }
    }

    return new Response(JSON.stringify({ processed: emails.length }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error in process-email-queue:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500 },
    );
  }
});
