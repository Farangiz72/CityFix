import L from 'leaflet';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  value: LatLng | null;
  onChange?: (value: LatLng) => void;
  height?: string;
}

const DEFAULT_CENTER: [number, number] = [55.7558, 37.6173];
const DEFAULT_ZOOM = 13;

const markerIcon = L.divIcon({
  className: 'cityfix-marker',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function popupContent(point: LatLng): string {
  // Только числа: содержимое попапа всегда текст, без пользовательских строк.
  return `<strong>Точка заявки</strong><br>${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

function createMarker(map: L.Map, point: LatLng, openPopup = false): L.Marker {
  const marker = L.marker([point.lat, point.lng], { icon: markerIcon })
    .bindPopup(popupContent(point))
    .addTo(map);
  if (openPopup) {
    marker.openPopup();
  }
  return marker;
}

/**
 * Карта выбора точки (FR-2). Без `onChange` работает как просмотр (карточка заявки).
 * Клик по карте ставит маркер — координаты уходят в форму.
 */
export function MapPicker({ value, onChange, height = '320px' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      center: value ? [value.lat, value.lng] : DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      // Обязательная атрибуция OSM / required OpenStreetMap attribution
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    if (value) {
      // Просмотр (карточка заявки) сразу показывает аккуратный попап с координатами.
      markerRef.current = createMarker(map, value, !onChangeRef.current);
    }

    map.on('click', (event: L.LeafletMouseEvent) => {
      // Без onChange карта работает как просмотр: клик не двигает точку.
      if (!onChangeRef.current) {
        return;
      }
      const next = { lat: event.latlng.lat, lng: event.latlng.lng };
      if (markerRef.current) {
        markerRef.current.setLatLng([next.lat, next.lng]);
        markerRef.current.setPopupContent(popupContent(next));
      } else {
        markerRef.current = createMarker(map, next);
      }
      onChangeRef.current?.(next);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Карта создаётся один раз; точка обновляется во втором эффекте.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
      markerRef.current.setPopupContent(popupContent(value));
    } else {
      markerRef.current = createMarker(map, value);
    }
    map.setView([value.lat, value.lng], map.getZoom());
  }, [value?.lat, value?.lng]);

  return (
    <div className="map">
      <div ref={containerRef} className="map__canvas" style={{ height }} />
      <p className="map__hint">
        {onChange ? 'Клик по карте ставит точку / click the map to pick a point' : 'Место заявки на карте'}
        {value ? ` · ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : ''}
      </p>
    </div>
  );
}
