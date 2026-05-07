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
  onSelect?: (location: LocationData) => void;
  initialLocation?: {
    latitude?: number;
    longitude?: number;
    address?: string;
    neighborhood?: string;
    city?: string;
  };
  readOnly?: boolean;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

const createMarkerElement = (color: string) => {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-map-pin';
  icon.style.cssText = `
    color: ${color};
    font-size: 32px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  `;
  
  el.appendChild(icon);
  return el;
};

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialLocation,
  readOnly = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  const [isLocationActive, setIsLocationActive] = useState(false);
  const [isEntryActive, setIsEntryActive] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  
  const [polygons, setPolygons] = useState<{id: string, points: number[][], color: string}[]>([]);
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const [editingPolygonId, setEditingPolygonId] = useState<string | null>(null);
  
  useEffect(() => { isLocationActiveRef.current = isLocationActive; }, [isLocationActive]);
  useEffect(() => { isEntryActiveRef.current = isEntryActive; }, [isEntryActive]);
  useEffect(() => { isDrawModeRef.current = isDrawMode; }, [isDrawMode]);
  useEffect(() => { currentPointsRef.current = currentPoints; }, [currentPoints]);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const locationMarkerRef = useRef<any>(null);
  const entryMarkerRef = useRef<any>(null);
  const editMarkersRef = useRef<any[]>([]);
  
  const mapRef = useRef<any>(null);
  const mapboxglRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const polygonIdCounter = useRef(0);
  
  const isDrawModeRef = useRef(false);
  const isLocationActiveRef = useRef(false);
  const isEntryActiveRef = useRef(false);
  const currentPointsRef = useRef<number[][]>([]);
  const drawPointMarkersRef = useRef<any[]>([]);

  

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const initMap = async () => {
      const mapboxgl = await import('mapbox-gl');
      mapboxglRef.current = mapboxgl.default;
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

      map.addControl(new mapboxgl.default.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        setMapLoaded(true);

        if (initialLocation?.latitude && initialLocation?.longitude) {
          updateLocationFields(
            initialLocation.latitude,
            initialLocation.longitude,
            initialLocation.address || '',
            initialLocation.neighborhood || '',
            initialLocation.city || ''
          );
          
          const markerEl = createMarkerElement('#004080');
          const marker = new mapboxgl.default.Marker({ element: markerEl, draggable: false })
            .setLngLat(initialCenter)
            .addTo(map);
          locationMarkerRef.current = marker;
        }
      });
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapLoaded(false);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setMapLoaded(false);
      setMapStyle('streets');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedLocation(null);
    }
  }, [isOpen]);

  

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;

    polygons.forEach(poly => {
      renderPolygon(poly.points, poly.id, poly.color);
    });
  }, [mapLoaded, polygons]);

  const renderPolygon = React.useCallback((points: number[][], id: string, color: string) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    const lineId = `${id}-line`;
    const fillId = `${id}-fill`;
    const outlineId = `${id}-outline`;
    
    if (points.length >= 2) {
      const lineData = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } };
      if (map.getSource(lineId)) {
        map.getSource(lineId).setData(lineData);
      } else {
        map.addSource(lineId, { type: 'geojson', data: lineData });
        map.addLayer({ id: lineId, type: 'line', source: lineId, paint: { 'line-color': color, 'line-width': 3 } });
      }
    }
    
    if (points.length >= 3) {
      const polygonData = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [points] } };
      if (map.getSource(fillId)) {
        map.getSource(fillId).setData(polygonData);
      } else {
        map.addSource(fillId, { type: 'geojson', data: polygonData });
        map.addLayer({ id: fillId, type: 'fill', source: fillId, paint: { 'fill-color': color, 'fill-opacity': 0.3 } });
        map.addLayer({ id: outlineId, type: 'line', source: fillId, paint: { 'line-color': color, 'line-width': 2 } });
      }
    }
  }, []);

  const handleMapClick = React.useCallback((e: any) => {
    if (!mapRef.current || !mapLoaded || readOnly) return;

    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;
    const lngLat = e.lngLat;
    if (!lngLat || isNaN(lngLat.lng) || isNaN(lngLat.lat)) return;

    if (isLocationActiveRef.current && locationMarkerRef.current) {
      locationMarkerRef.current.setLngLat([lngLat.lng, lngLat.lat]);
      setSelectedLocation({ address: 'Carregando...', neighborhood: '', city: '', latitude: lngLat.lat, longitude: lngLat.lng });
      reverseGeocode(lngLat.lng, lngLat.lat);
    } else if (isEntryActiveRef.current && entryMarkerRef.current) {
      entryMarkerRef.current.setLngLat([lngLat.lng, lngLat.lat]);
    } else if (isDrawModeRef.current) {
      const newPoints = [...currentPointsRef.current, [lngLat.lng, lngLat.lat]];
      setCurrentPoints(newPoints);
      
      if (mapboxgl) {
        const pointEl = document.createElement('div');
        pointEl.style.cssText = 'width:12px;height:12px;background-color:#f59e0b;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:pointer;';
        const marker = new mapboxgl.Marker({ element: pointEl, draggable: false })
          .setLngLat([lngLat.lng, lngLat.lat])
          .addTo(map);
        drawPointMarkersRef.current.push(marker);
      }
    }
  }, [mapLoaded, readOnly, renderPolygon, isDrawMode, isLocationActive, isEntryActive]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded || readOnly) return;
    const map = mapRef.current;
    map.on('click', handleMapClick);
    return () => { map.off('click', handleMapClick); };
  }, [handleMapClick, mapLoaded, readOnly]);

  const handleSavePolygon = () => {
    if (currentPoints.length < 3) return;
    
    const newPolygon = {
      id: `polygon-${polygonIdCounter.current++}`,
      points: [...currentPoints],
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    };
    
    setPolygons([...polygons, newPolygon]);
    setCurrentPoints([]);
    setIsDrawMode(true);
    
    drawPointMarkersRef.current.forEach(m => m.remove());
    drawPointMarkersRef.current = [];
    
    if (mapRef.current) {
      if (mapRef.current.getSource('current-polygon-line')) mapRef.current.removeSource('current-polygon-line');
      if (mapRef.current.getLayer('current-polygon-line')) mapRef.current.removeLayer('current-polygon-line');
      if (mapRef.current.getSource('current-polygon-fill')) mapRef.current.removeSource('current-polygon-fill');
      if (mapRef.current.getLayer('current-polygon-fill')) mapRef.current.removeLayer('current-polygon-fill');
      if (mapRef.current.getLayer('current-polygon-outline')) mapRef.current.removeLayer('current-polygon-outline');
    }
  };

  const handleClearCurrentPolygon = () => {
    setCurrentPoints([]);
    drawPointMarkersRef.current.forEach(m => m.remove());
    drawPointMarkersRef.current = [];
    if (mapRef.current) {
      if (mapRef.current.getSource('current-polygon-line')) mapRef.current.removeSource('current-polygon-line');
      if (mapRef.current.getLayer('current-polygon-line')) mapRef.current.removeLayer('current-polygon-line');
      if (mapRef.current.getSource('current-polygon-fill')) mapRef.current.removeSource('current-polygon-fill');
      if (mapRef.current.getLayer('current-polygon-fill')) mapRef.current.removeLayer('current-polygon-fill');
      if (mapRef.current.getLayer('current-polygon-outline')) mapRef.current.removeLayer('current-polygon-outline');
    }
  };

  const handleDeletePolygon = (id: string) => {
    setPolygons(polygons.filter(p => p.id !== id));
    if (mapRef.current) {
      if (mapRef.current.getSource(`${id}-line`)) mapRef.current.removeSource(`${id}-line`);
      if (mapRef.current.getLayer(`${id}-line`)) mapRef.current.removeLayer(`${id}-line`);
      if (mapRef.current.getSource(`${id}-fill`)) mapRef.current.removeSource(`${id}-fill`);
      if (mapRef.current.getLayer(`${id}-fill`)) mapRef.current.removeLayer(`${id}-fill`);
      if (mapRef.current.getLayer(`${id}-outline`)) mapRef.current.removeLayer(`${id}-outline`);
    }
  };

  const handleEditPolygon = (polygon: {id: string, points: number[][]}) => {
    const map = mapboxglRef.current;
    const mapObj = mapRef.current;
    if (!map || !mapObj) return;
    
    if (editingPolygonId) {
      editMarkersRef.current.forEach(m => m.remove());
      editMarkersRef.current = [];
      setEditingPolygonId(null);
    } else {
      setEditingPolygonId(polygon.id);
      
      polygon.points.forEach((point, index) => {
        const el = document.createElement('div');
        el.style.cssText = 'width:20px;height:20px;background-color:#f59e0b;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:grab;';
        
        const marker = new map.Marker({ element: el, draggable: true }).setLngLat(point).addTo(mapObj);
        
        marker.on('dragend', () => {
          const newLngLat = marker.getLngLat();
          const newPoints = [...polygons.find(p => p.id === polygon.id)!.points];
          newPoints[index] = [newLngLat.lng, newLngLat.lat];
          
          setPolygons(polygons.map(p => p.id === polygon.id ? {...p, points: newPoints} : p));
          renderPolygon(newPoints, polygon.id, polygons.find(p => p.id === polygon.id)!.color);
        });
        
        editMarkersRef.current.push(marker);
      });
    }
  };

  const reverseGeocode = async (lng: number, lat: number) => {
    try {
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=pt-BR`);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const context = feature.context || [];
        const street = feature.address ? `${feature.text}, ${feature.address}` : feature.text;
        const neighborhood = context.find((c: any) => c.id.startsWith('neighborhood'))?.text || '';
        const city = context.find((c: any) => c.id.startsWith('place'))?.text || feature.text;
        
        updateLocationFields(lat, lng, street, neighborhood, city);
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
    }
  };

  const updateLocationFields = (lat: number, lng: number, address: string, neighborhood: string, city: string) => {
    setSelectedLocation({ address, neighborhood, city, latitude: lat, longitude: lng });
  };

  const handleSearch = async (query: string) => {
    if (query.length < 3 || readOnly) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&language=pt-BR&limit=5`);
      const data = await response.json();
      if (data.features) setSearchResults(data.features);
    } catch (error) { console.error('Search error:', error); }
    finally { setIsSearching(false); }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchQuery.length >= 3 && !readOnly) {
      searchTimeoutRef.current = setTimeout(() => { handleSearch(searchQuery); }, 300);
    }
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery, readOnly]);

  const handleSelectResult = async (result: any) => {
    if (readOnly) return;
    const [lng, lat] = result.center;
    const street = result.address ? `${result.text}, ${result.address}` : result.text;
    const neighborhood = result.context?.find((c: any) => c.id.startsWith('neighborhood'))?.text || '';
    const city = result.context?.find((c: any) => c.id.startsWith('place'))?.text || result.text;

    setSelectedLocation({ address: street, neighborhood, city, latitude: lat, longitude: lng });
    if (mapRef.current) mapRef.current.flyTo({ center: [lng, lat], zoom: 16 });

    if (!locationMarkerRef.current) {
      const markerEl = createMarkerElement('#004080');
      const marker = new mapboxglRef.current.Marker({ element: markerEl, draggable: true })
        .setLngLat([lng, lat]).addTo(mapRef.current);
      marker.on('dragend', async () => {
        const lngLat = marker.getLngLat();
        await reverseGeocode(lngLat.lng, lngLat.lat);
      });
      locationMarkerRef.current = marker;
    } else {
      locationMarkerRef.current.setLngLat([lng, lat]);
    }
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    const newState = !isLocationActive;
    setIsLocationActive(newState);
    setIsEntryActive(false);
    setIsDrawMode(false);
    
    if (newState) {
      if (!locationMarkerRef.current && mapRef.current && mapLoaded) {
        const map = mapboxglRef.current;
        const mapObj = mapRef.current;
        const bounds = mapObj.getBounds();
        const center = bounds.getCenter();
        
        const markerEl = createMarkerElement('#004080');
        const marker = new map.Marker({ element: markerEl, draggable: true })
          .setLngLat(center).addTo(mapObj);
        
        marker.on('dragend', async () => {
          const lngLat = marker.getLngLat();
          await reverseGeocode(lngLat.lng, lngLat.lat);
        });
        
        locationMarkerRef.current = marker;
        setTimeout(() => { mapObj.flyTo({ center, zoom: 16, duration: 500 }); }, 100);
      } else if (locationMarkerRef.current) {
        locationMarkerRef.current.setDraggable(true);
        const center = locationMarkerRef.current.getLngLat();
        mapRef.current.flyTo({ center: [center.lng, center.lat], zoom: 16, duration: 500 });
      }
    } else if (locationMarkerRef.current) {
      locationMarkerRef.current.setDraggable(false);
      locationMarkerRef.current.remove();
      locationMarkerRef.current = null;
    }
  };

  const handleEntryClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    const newState = !isEntryActive;
    setIsEntryActive(newState);
    setIsLocationActive(false);
    setIsDrawMode(false);
    
    if (newState) {
      if (!entryMarkerRef.current && mapRef.current && mapLoaded) {
        const map = mapboxglRef.current;
        const mapObj = mapRef.current;
        const bounds = mapObj.getBounds();
        const center = bounds.getCenter();
        
        const markerEl = createMarkerElement('#22c55e');
        const marker = new map.Marker({ element: markerEl, draggable: true })
          .setLngLat(center).addTo(mapObj);
        
        entryMarkerRef.current = marker;
        setTimeout(() => { mapObj.flyTo({ center, zoom: 16, duration: 500 }); }, 100);
      } else if (entryMarkerRef.current) {
        entryMarkerRef.current.setDraggable(true);
      }
    } else if (entryMarkerRef.current) {
      entryMarkerRef.current.setDraggable(false);
      entryMarkerRef.current.remove();
      entryMarkerRef.current = null;
    }
  };

  const handleDrawClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    const willDisable = isDrawMode;
    setIsDrawMode(!isDrawMode);
    setIsLocationActive(false);
    setIsEntryActive(false);
    
    if (willDisable) {
      drawPointMarkersRef.current.forEach(m => m.remove());
      drawPointMarkersRef.current = [];
      setCurrentPoints([]);
      if (mapRef.current) {
        if (mapRef.current.getSource('current-polygon-line')) mapRef.current.removeSource('current-polygon-line');
        if (mapRef.current.getLayer('current-polygon-line')) mapRef.current.removeLayer('current-polygon-line');
        if (mapRef.current.getSource('current-polygon-fill')) mapRef.current.removeSource('current-polygon-fill');
        if (mapRef.current.getLayer('current-polygon-fill')) mapRef.current.removeLayer('current-polygon-fill');
        if (mapRef.current.getLayer('current-polygon-outline')) mapRef.current.removeLayer('current-polygon-outline');
      }
    }
    
    if (editingPolygonId) {
      editMarkersRef.current.forEach(m => m.remove());
      editMarkersRef.current = [];
      setEditingPolygonId(null);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation && onSelect) {
      onSelect(selectedLocation);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[999] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="bg-[#004080] text-white px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-black uppercase tracking-wider">{readOnly ? 'Visualizar Localização' : 'Buscar Localização'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {!readOnly && (
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar endereço, bairro ou cidade..."
                className="w-full px-4 py-3 pl-11 rounded-xl border border-slate-200 outline-none focus:border-[#004080] focus:ring-2 focus:ring-[#004080]/10 text-sm"
              />
              <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              {isSearching && <i className="fa-solid fa-circle-notch fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-[#004080]"></i>}
            </div>
            {searchResults.length > 0 && (
              <div className="absolute left-4 right-4 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <button key={index} onClick={() => handleSelectResult(result)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-b-0 transition-colors">
                    <p className="text-sm font-medium text-slate-800">{result.text}</p>
                    <p className="text-xs text-slate-500">{result.context?.map((c: any) => c.text).join(', ')}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {mapLoaded && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 flex-wrap">
            <button type="button" onClick={() => {
                const newStyle = mapStyle === 'streets' ? 'satellite' : 'streets';
                setMapStyle(newStyle);
                if (mapRef.current && mapLoaded) {
                  mapRef.current.setStyle(newStyle === 'satellite' ? 'mapbox://styles/mapbox/satellite-streets-v12' : 'mapbox://styles/mapbox/streets-v12');
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-600 hover:border-[#004080] transition-all">
              <i className={`fa-solid fa-earth-americas text-xl ${mapStyle === 'satellite' ? 'text-green-600' : 'text-blue-600'}`}></i>
              <span className="text-xs font-bold">{mapStyle === 'streets' ? 'Satélite' : 'Ruas'}</span>
            </button>
            
            {!readOnly && (
              <>
                <button type="button" onClick={handleLocationClick} disabled={readOnly}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${isLocationActive ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-500'} ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <i className={`fa-solid fa-map-pin text-xl ${isLocationActive ? 'text-amber-600' : 'text-[#004080]'}`}></i>
                  <span className="text-xs font-bold">Localização</span>
                </button>
                
                <button type="button" onClick={handleEntryClick} disabled={readOnly}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${isEntryActive ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-500'} ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <i className={`fa-solid fa-door-open text-xl ${isEntryActive ? 'text-emerald-600' : 'text-[#22c55e]'}`}></i>
                  <span className="text-xs font-bold">Entrada Ramal</span>
                </button>
                
                <button type="button" onClick={handleDrawClick} disabled={readOnly}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${isDrawMode ? 'bg-orange-100 border-orange-500 text-orange-700' : 'bg-white border-slate-200 text-slate-600 hover:border-orange-500'} ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <i className={`fa-solid fa-draw-polygon text-xl ${isDrawMode ? 'text-orange-600' : 'text-orange-500'}`}></i>
                  <span className="text-xs font-bold">Área</span>
                </button>

                {polygons.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap ml-auto">
                    {polygons.map((poly, idx) => (
                      <div key={poly.id} className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-xs">
                        <span style={{color: poly.color}} className="font-bold">#{idx + 1}</span>
                        <button type="button" onClick={() => handleEditPolygon(poly)} className="text-slate-500 hover:text-slate-700">
                          <i className={`fa-solid fa-edit ${editingPolygonId === poly.id ? 'text-orange-600' : ''}`}></i>
                        </button>
                        <button type="button" onClick={() => handleDeletePolygon(poly.id)} className="text-red-500 hover:text-red-700">
                          <i className="fa-solid fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {isDrawMode && currentPoints.length >= 3 && (
                  <button type="button" onClick={handleSavePolygon} className="ml-auto px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600">
                    Salvar Área
                  </button>
                )}
                {isDrawMode && currentPoints.length > 0 && currentPoints.length < 3 && (
                  <button type="button" onClick={handleClearCurrentPolygon} className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium">
                    Limpar
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className="relative">
          {isOpen && <div ref={mapContainerRef} className={`w-full h-64 bg-slate-100 ${isDrawMode ? 'cursor-crosshair' : !readOnly ? 'cursor-pointer' : ''}`}>
            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
                <div className="text-center">
                  <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#004080] mb-2"></i>
                  <p className="text-sm text-slate-500">Carregando mapa...</p>
                </div>
              </div>
            )}
          </div>}
        </div>

        {selectedLocation && (
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><p className="text-[10px] text-slate-500 font-bold uppercase">Endereço</p><p className="font-medium text-slate-800">{selectedLocation.address}</p></div>
              <div><p className="text-[10px] text-slate-500 font-bold uppercase">Bairro</p><p className="font-medium text-slate-800">{selectedLocation.neighborhood || '-'}</p></div>
              <div><p className="text-[10px] text-slate-500 font-bold uppercase">Município</p><p className="font-medium text-slate-800">{selectedLocation.city || '-'}</p></div>
              <div><p className="text-[10px] text-slate-500 font-bold uppercase">Coordenadas</p><p className="font-medium text-slate-800">{selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}</p></div>
            </div>
          </div>
        )}

        {!readOnly && (
          <div className="p-4 border-t border-slate-100 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 bg-slate-100 rounded-xl transition-colors">Cancelar</button>
            <button onClick={handleConfirm} disabled={!selectedLocation} className="flex-1 py-3 text-xs font-black uppercase tracking-wider bg-[#004080] text-white rounded-xl hover:bg-[#003060] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Confirmar Localização</button>
          </div>
        )}

        {readOnly && (
          <div className="p-4 border-t border-slate-100">
            <button onClick={onClose} className="w-full py-3 text-xs font-black uppercase tracking-wider text-white bg-slate-500 hover:bg-slate-600 rounded-xl transition-colors">Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
};