#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Outlook Email Automation - Portal APR
Opens an email in Outlook with pre-filled TO, CC, Subject, HTML body, and attachments.

Usage:
    python outlook_email.py

Input: JSON via stdin with fields:
    - to: recipient email(s), semicolon-separated
    - cc: CC email(s), semicolon-separated (optional)
    - subject: email subject
    - htmlBody: HTML email body
    - senderName: sender display name (optional)
    - attachments: list of file paths to attach (optional)
    - inlineImages: list of {path, contentId} for CID-embedded images (optional)

Output: JSON via stdout with { success: bool, message: string }
"""

import sys
import io
import json
import os

# Force UTF-8 encoding for stdin/stdout on Windows
if sys.platform == 'win32':
    import locale
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if sys.stderr.encoding != 'utf-8':
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    if sys.stdin.encoding != 'utf-8':
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')

def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)

        to = data.get('to', '')
        cc = data.get('cc', '')
        subject = data.get('subject', '')
        html_body = data.get('htmlBody', '')
        sender_name = data.get('senderName', '')
        attachments = data.get('attachments', [])
        inline_images = data.get('inlineImages', [])

        if not to:
            print(json.dumps({"success": False, "message": "Recipient (to) is required"}))
            return

        try:
            import win32com.client
        except ImportError:
            print(json.dumps({"success": False, "message": "pywin32 not installed. Run: pip install pywin32"}))
            return

        outlook = win32com.client.Dispatch('Outlook.Application')
        mail = outlook.CreateItem(0)  # olMailItem

        mail.To = to

        if cc and cc.strip():
            mail.CC = cc.strip()

        mail.Subject = subject
        mail.HTMLBody = html_body

        # Add inline images as CID attachments (must be added BEFORE Display)
        for img in inline_images:
            img_path = img.get('path', '')
            content_id = img.get('contentId', '')
            if img_path and os.path.exists(img_path) and content_id:
                try:
                    att = mail.Attachments.Add(img_path)
                    att.PropertyAccessor.SetProperty(
                        "http://schemas.microsoft.com/mapi/proptag/0x3712001E", content_id
                    )
                except Exception as img_err:
                    print(json.dumps({"success": False, "message": f"Erro ao anexar imagem inline {os.path.basename(img_path)}: {str(img_err)}"}))
                    return

        # Add regular attachments if provided
        if attachments:
            for file_path in attachments:
                if os.path.exists(file_path):
                    try:
                        mail.Attachments.Add(file_path)
                    except Exception as att_err:
                        print(json.dumps({"success": False, "message": f"Erro ao anexar arquivo {os.path.basename(file_path)}: {str(att_err)}"}))
                        return
                else:
                    print(json.dumps({"success": False, "message": f"Arquivo nao encontrado: {file_path}"}))
                    return

        mail.Display(False)

        print(json.dumps({"success": True, "message": "Email opened in Outlook"}))

    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "message": f"Invalid JSON input: {str(e)}"}))
    except Exception as e:
        error_msg = str(e)
        if "The object does not support this property or method" in error_msg:
            error_msg = "Outlook is not installed or not accessible"
        elif "Server unavailable" in error_msg or "RPC" in error_msg:
            error_msg = "Outlook is not running or not responding"
        print(json.dumps({"success": False, "message": f"Outlook error: {error_msg}"}))


if __name__ == '__main__':
    main()


if __name__ == '__main__':
    main()
