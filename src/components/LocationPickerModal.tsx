import React, { useState, useEffect, useRef } from 'react';

interface LocationData {
  address: string;
  neighborhood: string;
  city: string;
  latitude: number;
  longitude: number;
}

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: LocationData) => void;
  initialLocation?: {
    latitude?: number;
    longitude?: number;
    address?: string;
    neighborhood?: string;
    city?: string;
  };
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialLocation
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const initMap = async () => {
      const mapboxgl = await import('mapbox-gl');
      await import('mapbox-gl/dist/mapbox-gl.css');

      mapboxgl.default.accessToken = MAPBOX_TOKEN;

      const initialCenter: [number, number] = initialLocation?.latitude && initialLocation?.longitude
        ? [initialLocation.longitude, initialLocation.latitude]
        : [-43.2098, -22.9028];

      const map = new mapboxgl.default.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: initialCenter,
        zoom: initialLocation?.latitude ? 14 : 10
      });

      mapRef.current = map;

      map.addControl(new mapboxgl.default.NavigationControl(), 'top-right');

      map.on('load', () => {
        setMapLoaded(true);

        const markerEl = document.createElement('div');
        markerEl.className = 'w-8 h-8 bg-[#004080] rounded-full border-4 border-white shadow-lg cursor-grab flex items-center justify-center';
        markerEl.innerHTML = '<i class="fa-solid fa-location-dot text-white text-sm"></i>';
        markerEl.style.transform = 'translate(-50%, -100%)';

        const marker = new mapboxgl.default.Marker({ element: markerEl, draggable: true })
          .setLngLat(initialCenter)
          .addTo(map);

        marker.on('dragend', async () => {
          const lngLat = marker.getLngLat();
          await reverseGeocode(lngLat.lng, lngLat.lat, mapboxgl.default);
        });

        markerRef.current = marker;

        if (initialLocation?.latitude && initialLocation?.longitude) {
          updateLocationFields(
            initialLocation.latitude,
            initialLocation.longitude,
            initialLocation.address || '',
            initialLocation.neighborhood || '',
            initialLocation.city || '',
            mapboxgl.default
          );
        }
      });
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen]);

  const reverseGeocode = async (lng: number, lat: number, mapboxgl: any) => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=pt-BR`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const context = feature.context || [];
        
        const street = feature.address 
          ? `${feature.text}, ${feature.address}` 
          : feature.text;
        
        const neighborhood = context.find((c: any) => c.id.startsWith('neighborhood'))?.text || '';
        const city = context.find((c: any) => c.id.startsWith('place'))?.text || feature.text;
        
        updateLocationFields(lat, lng, street, neighborhood, city, mapboxgl);
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
    }
  };

  const updateLocationFields = (
    lat: number,
    lng: number,
    address: string,
    neighborhood: string,
    city: string,
    _mapboxgl: any
  ) => {
    setSelectedLocation({
      address,
      neighborhood,
      city,
      latitude: lat,
      longitude: lng
    });
  };

  const handleSearch = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&language=pt-BR&limit=5`
      );
      const data = await response.json();
      
      if (data.features) {
        setSearchResults(data.features);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (searchQuery.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(searchQuery);
      }, 300);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectResult = async (result: any) => {
    const [lng, lat] = result.center;
    const context = result.context || [];
    
    const street = result.address 
      ? `${result.text}, ${result.address}` 
      : result.text;
    
    const neighborhood = context.find((c: any) => c.id.startsWith('neighborhood'))?.text || '';
    const city = context.find((c: any) => c.id.startsWith('place'))?.text || result.text;

    setSelectedLocation({
      address: street,
      neighborhood,
      city,
      latitude: lat,
      longitude: lng
    });

    if (mapRef.current && markerRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 16 });
      markerRef.current.setLngLat([lng, lat]);
    }

    setSearchResults([]);
    setSearchQuery('');
  };

  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current || !mapLoaded) return;

    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;

    const point = mapRef.current.project({ x: e.clientX, y: e.clientY });
    const lngLat = mapRef.current.unproject(point);

    if (markerRef.current) {
      markerRef.current.setLngLat([lngLat.lng, lngLat.lat]);
    }

    setSelectedLocation({
      address: 'Carregando...',
      neighborhood: '',
      city: '',
      latitude: lngLat.lat,
      longitude: lngLat.lng
    });

    await reverseGeocode(lngLat.lng, lngLat.lat, mapboxgl);
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelect(selectedLocation);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[999] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh]">
        <div className="bg-[#004080] text-white px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-black uppercase tracking-wider">Buscar Localização</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar endereço, bairro ou cidade..."
              className="w-full px-4 py-3 pl-11 rounded-xl border border-slate-200 outline-none focus:border-[#004080] focus:ring-2 focus:ring-[#004080]/10 text-sm"
            />
            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            
            {isSearching && (
              <i className="fa-solid fa-circle-notch fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-[#004080]"></i>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="absolute left-4 right-4 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectResult(result)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-b-0 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-800">{result.text}</p>
                  <p className="text-xs text-slate-500">
                    {result.context?.map((c: any) => c.text).join(', ')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div 
          ref={mapContainerRef}
          className="w-full h-80 bg-slate-100 cursor-pointer relative"
          onClick={handleMapClick}
        >
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="text-center">
                <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#004080] mb-2"></i>
                <p className="text-sm text-slate-500">Carregando mapa...</p>
              </div>
            </div>
          )}
        </div>

        {selectedLocation && (
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Endereço</p>
                <p className="font-medium text-slate-800">{selectedLocation.address}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Bairro</p>
                <p className="font-medium text-slate-800">{selectedLocation.neighborhood || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Município</p>
                <p className="font-medium text-slate-800">{selectedLocation.city || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Coordenadas</p>
                <p className="font-medium text-slate-800">
                  {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedLocation}
            className="flex-1 py-3 text-xs font-black uppercase tracking-wider bg-[#004080] text-white rounded-xl hover:bg-[#003060] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar Localização
          </button>
        </div>
      </div>
    </div>
  );
};