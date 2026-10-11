import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Field, Machine, BurnEvent, StorageYard, Buyer, LatLng } from '../../types';
import { supabase } from '../../lib/supabase';
import { Layers, Flame, MapPin, PackageCheck, Route, CloudSun, Building2, ChevronDown, Minus, Plus, LocateFixed, ListFilter, Search, X } from 'lucide-react';
import { FIELD_STAGES, STAGE_META, fieldRing, fieldStage, type FieldStage } from '../../lib/fieldStatus';
import { useAppLanguage } from '../../i18n/LanguageContext';

// Popups pan clear of the floating map controls (GPS badge, layers, zoom, legend).
L.Popup.mergeOptions({
  autoPanPaddingTopLeft: L.point(24, 72),
  autoPanPaddingBottomRight: L.point(64, 120),
  maxWidth: 300,
});

interface OpsMapProps {
  fields: Field[];
  machines: Machine[];
  fireEvents: BurnEvent[];
  storageYards: StorageYard[];
  buyers: Buyer[];
  selectedField: Field | null;
  onSelectField: (field: Field) => void;
  activeRoutePolyline?: LatLng[];
  highlightFirmsFire?: boolean;
  demoMode?: boolean;
  /** Open the field finder panel on first render (Track My Machine). */
  defaultFieldListOpen?: boolean;
}

export const OpsMap: React.FC<OpsMapProps> = ({
  fields,
  machines,
  fireEvents,
  storageYards,
  buyers,
  selectedField,
  onSelectField,
  activeRoutePolyline,
  highlightFirmsFire = true,
  demoMode = false,
  defaultFieldListOpen = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [tileMode] = useState<'satellite'>('satellite');
  const [showFires, setShowFires] = useState(true);
  const [showMachines, setShowMachines] = useState(true);
  const [showFields, setShowFields] = useState(true);
  const [showYards, setShowYards] = useState(true);
  const [showResidue, setShowResidue] = useState(true);
  const [showBuyers, setShowBuyers] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [fieldListOpen, setFieldListOpen] = useState(() => defaultFieldListOpen && (typeof window === 'undefined' || window.innerWidth > 720));
  const [fieldQuery, setFieldQuery] = useState('');
  const [hiddenStages, setHiddenStages] = useState<Set<FieldStage>>(() => new Set());
  const fittedRef = useRef(false);

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(FIELD_STAGES.map((stage) => [stage, 0])) as Record<FieldStage, number>;
    fields.forEach((field) => { counts[fieldStage(field.status)] += 1; });
    return counts;
  }, [fields]);

  const visibleFields = useMemo(() => fields.filter((field) => !hiddenStages.has(fieldStage(field.status))), [fields, hiddenStages]);

  const listedFields = useMemo(() => {
    const q = fieldQuery.trim().toLowerCase();
    if (!q) return visibleFields;
    return visibleFields.filter((field) => [field.khasra_no, field.village, field.farmer_name, field.id]
      .some((value) => String(value || '').toLowerCase().includes(q)));
  }, [visibleFields, fieldQuery]);

  const toggleStage = (stage: FieldStage) => {
    setHiddenStages((current) => {
      const next = new Set(current);
      if (next.has(stage)) next.delete(stage); else next.add(stage);
      return next;
    });
  };

  // Keep fields clear of the floating controls (finder panel, legend, zoom).
  const fitPadding = () => {
    const width = mapContainerRef.current?.clientWidth ?? 0;
    const panel = fieldListOpen && width > 640 ? 310 : 40;
    return { paddingTopLeft: L.point(panel, 110), paddingBottomRight: L.point(70, 130) };
  };

  const fitToFields = (list: Field[] = visibleFields) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const points = list.flatMap((field) => {
      const ring = fieldRing(field);
      return ring.length ? ring : [[Number(field.center?.lat), Number(field.center?.lng)] as [number, number]];
    }).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (points.length === 0) {
      map.flyTo([30.2458, 75.8421], 11);
      return;
    }
    map.flyToBounds(L.latLngBounds(points), { ...fitPadding(), maxZoom: 15, duration: 0.9 });
  };

  const focusField = (field: Field) => {
    onSelectField(field);
    const map = mapInstanceRef.current;
    const ring = fieldRing(field);
    if (map && ring.length >= 3) map.flyToBounds(L.latLngBounds(ring), { padding: [90, 90], maxZoom: 16, duration: 0.9 });
    else if (map && field.center) map.flyTo([field.center.lat, field.center.lng], 15, { duration: 0.9 });
  };
  const [weatherPoint, setWeatherPoint] = useState<{ temperature: number; precipitationProbability: number; precipitationMm: number; windGustKmh: number } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [mapError, setMapError] = useState<string | null>(null);
  const [animatedPositions, setAnimatedPositions] = useState<Record<string, { lat: number; lng: number }>>(
    () => demoMode ? Object.fromEntries(machines.map(m => [m.id, m.current_location])) : {}
  );
  const [locationTimestamps, setLocationTimestamps] = useState<Record<string, string>>({});
  const [locationLoadError, setLocationLoadError] = useState('');
  const { t } = useAppLanguage();

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centered at Sangrur, Punjab
    let map: L.Map;
    try {
      map = L.map(mapContainerRef.current, {
      center: [30.2458, 75.8421],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });
    } catch (error) {
      console.error('[NIRDHOOM] Leaflet initialization failed:', error);
      setMapError(error instanceof Error ? error.message : 'Unable to initialize the operational map.');
      return;
    }

    setMapError(null);
    mapInstanceRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // In live mode, machine markers come only from persisted device GPS records.
  // Never animate a vehicle toward a field: that would present fabricated positions as live telemetry.
  useEffect(() => {
    if (demoMode || !supabase) {
      setAnimatedPositions(Object.fromEntries(machines.map((machine) => [machine.id, machine.current_location])));
      setLocationTimestamps({});
      setLocationLoadError('');
      return;
    }
    let active = true;
    const refreshLocations = async () => {
      try {
        const { data: sessionResult } = await supabase.auth.getSession();
        const token = sessionResult.session?.access_token;
        if (!token) {
          if (active) {
            setAnimatedPositions({});
            setLocationTimestamps({});
            setLocationLoadError('Sign in with an authorized account to view live machine GPS.');
          }
          return;
        }
        const { data, error } = await supabase
          .from('machine_locations')
          .select('machine_id,latitude,longitude,recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        if (!active) return;
        const now = Date.now();
        const positions: Record<string, { lat: number; lng: number }> = {};
        const timestamps: Record<string, string> = {};
        for (const row of data || []) {
          if (timestamps[row.machine_id]) continue;
          const lat = Number(row.latitude);
          const lng = Number(row.longitude);
          const recordedAt = Date.parse(row.recorded_at);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
          if (!Number.isFinite(recordedAt) || now - recordedAt > 30 * 60 * 1000 || recordedAt > now + 60_000) continue;
          positions[row.machine_id] = { lat, lng };
          timestamps[row.machine_id] = row.recorded_at;
        }
        setAnimatedPositions(positions);
        setLocationTimestamps(timestamps);
        setLocationLoadError('');
        setLastRefresh(new Date());
      } catch (error) {
        if (!active) return;
        setLocationLoadError(error instanceof Error ? error.message : 'Live GPS could not be refreshed.');
      }
    };
    void refreshLocations();
    const interval = window.setInterval(() => void refreshLocations(), 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [demoMode, machines]);

    // Weather is an operational planning layer, sourced through the authenticated weather adapter.
  useEffect(() => {
    if (demoMode || !showWeather || !selectedField?.dbId || !supabase) {
      setWeatherPoint(null);
      return;
    }
    const client = supabase;
    let active = true;
    const loadWeather = async () => {
      try {
        const { data } = await client.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch(`/api/weather?field_id=${encodeURIComponent(selectedField.dbId!)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const payload = await response.json();
        const currentIndex = payload.forecast?.hourly?.time?.length ? 0 : -1;
        if (!active || currentIndex < 0) return;
        setWeatherPoint({
          temperature: Number(payload.forecast.hourly.temperature_2m?.[currentIndex] ?? 0),
          precipitationProbability: Number(payload.forecast.hourly.precipitation_probability?.[currentIndex] ?? 0),
          precipitationMm: Number(payload.forecast.hourly.precipitation?.[currentIndex] ?? 0),
          windGustKmh: Number(payload.forecast.hourly.wind_gusts_10m?.[currentIndex] ?? 0),
        });
      } catch {
        if (active) setWeatherPoint(null);
      }
    };
    void loadWeather();
    return () => { active = false; };
  }, [demoMode, selectedField?.dbId, showWeather]);

// Update base tile layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    // Machine tracking uses a field satellite layer only; avoid a second visual language.
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18, maxNativeZoom: 17 }
    ).addTo(map);
  }, [tileMode]);

  // Render Polygons, Markers, FIRMS Fires, and Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 1. Render Registered Customer Fields (Polygons)
    if (showFields) {
      visibleFields.forEach((field) => {
        const isSelected = selectedField?.id === field.id;
        const coords = fieldRing(field);
        if (coords.length < 3) return;

        const stage = STAGE_META[fieldStage(field.status)];

        const polygon = L.polygon(coords, {
          color: isSelected ? '#ffffff' : stage.stroke,
          weight: isSelected ? 4 : 2.5,
          fillColor: stage.fill,
          fillOpacity: isSelected ? 0.62 : 0.4,
          dashArray: stage.dashed ? '5, 5' : undefined,
        });

        polygon.bindTooltip(
          `<div class="map-pop-title">${field.khasra_no}</div><div class="map-pop-sub">${field.farmer_name} · ${field.village}</div><div><span class="map-pop-stage" style="--stage:${stage.fill}">${stage.label}</span> ${field.acreage} ac (${field.paddy_variety})</div><div class="map-pop-note">Click to open field details</div>`,
          { direction: 'top', className: 'leaflet-custom-tooltip', sticky: true }
        );

        polygon.on('click', () => {
          onSelectField(field);
        });

        // A pin at the field centre keeps small fields findable when zoomed out.
        const pinIcon = L.divIcon({
          html: `<div class="map-field-pin${isSelected ? ' is-selected' : ''}" style="--stage:${stage.fill}"><span></span><b>${field.khasra_no || ''}</b></div>`,
          className: 'map-field-pin-wrap',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const center = field.center && Number.isFinite(Number(field.center.lat))
          ? [Number(field.center.lat), Number(field.center.lng)] as [number, number]
          : L.polygon(coords).getBounds().getCenter();
        L.marker(center, { icon: pinIcon, zIndexOffset: isSelected ? 900 : 300, keyboard: false })
          .on('click', () => focusField(field))
          .addTo(layerGroup);

        polygon.addTo(layerGroup);
      });
    }

    // 2. Render Registered Machine Capacity
    if (showMachines) {
      machines.forEach((machine) => {
        const iconHtml = `
          <div class="map-machine">
            <div class="map-machine-dot"><span>🚜</span></div>
            <div class="map-machine-label">${machine.name.split(' ')[0]} #${machine.id.slice(-2)}</div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-baler-icon',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const pos = demoMode ? (animatedPositions[machine.id] || machine.current_location) : animatedPositions[machine.id];
        if (!pos || !Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lng))) return;
        const marker = L.marker([Number(pos.lat), Number(pos.lng)], {
          icon: customIcon,
        });

        marker.bindPopup(`
          <div class="map-pop">
            <div class="map-pop-title">${machine.name}</div>
            <div class="map-pop-sub">${machine.home_chc}</div>
            <div class="map-pop-rows">
            <div><strong>Type:</strong> ${machine.type}</div>
            <div><strong>Capacity:</strong> ${machine.capacity_acres_day} acres/day</div>
            <div><strong>Tractor:</strong> ${machine.tractor_hp_required ? machine.tractor_hp_required + " HP" : "Not sourced"}</div>
            <div><strong>Residue:</strong> ${(machine.residue_types || ["Not established"]).join(", ")}</div>
            <div><strong>Operator:</strong> ${machine.operator_name} (${machine.operator_phone})</div>
            </div>
            <div class="map-pop-note">Capability source: ${machine.capability_source || "Not established"}${machine.capability_source_date ? " · " + machine.capability_source_date : ""}</div>
            <div class="map-pop-status"><strong>Status:</strong> <span class="map-pop-chip is-green">${machine.status}</span></div>
            <div class="map-pop-note">${demoMode ? 'Demo position — not live GPS' : `Last device GPS: ${locationTimestamps[machine.id] ? new Date(locationTimestamps[machine.id]).toLocaleString('en-IN') : 'Unavailable'}`}</div>
          </div>
        `);

        marker.addTo(layerGroup);
      });
    }

    // 3. Render NASA FIRMS Active Fire Anomalies (Red Pulsing Beacons)
    if (showFires && highlightFirmsFire) {
      fireEvents.forEach((fire) => {
        const fireHtml = `
          <div class="map-fire">
            <div class="map-fire-pulse"></div>
            <div class="map-fire-dot"><span>🔥</span></div>
          </div>
        `;

        const fireIcon = L.divIcon({
          html: fireHtml,
          className: 'custom-fire-icon',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        if (!Number.isFinite(Number(fire.firms_point?.lat)) || !Number.isFinite(Number(fire.firms_point?.lng))) return;
        const marker = L.marker([Number(fire.firms_point.lat), Number(fire.firms_point.lng)], {
          icon: fireIcon,
        });

        marker.bindPopup(`
          <div class="map-pop">
            <div class="map-pop-title is-ember">🔥 NASA FIRMS VIIRS Active Fire</div>
            <div class="map-pop-rows">
            <div>Location: ${fire.nearest_village}</div>
            <div>Satellite: ${fire.satellite}</div>
            <div>Confidence: ${fire.confidence}% | Temp: ${fire.brightness_temp_kelvin} K</div>
            </div>
            <div class="map-pop-chip is-ember">
              ⚠️ UNREGISTERED FIELD (NO NIRDHOOM CONTRACT)
            </div>
          </div>
        `);

        marker.addTo(layerGroup);
      });
    }

        // 4. Render residue lots at their field origin.
    if (showResidue) {
      fields
        .filter((field) => Boolean(field.residue_lot_id) || field.status === 'VERIFIED_NON_BURN')
        .forEach((field) => {
          const pos = field.center;
          if (!Number.isFinite(Number(pos?.lat)) || !Number.isFinite(Number(pos?.lng))) return;
          const icon = L.divIcon({
            html: '<div class="map-tile-icon is-green">🌾</div>',
            className: 'residue-lot-icon',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });
          L.marker([Number(pos.lat), Number(pos.lng)], { icon })
            .bindPopup(`<div class="map-pop"><div class="map-pop-title">Residue lot</div><div class="map-pop-rows"><div>Field: ${field.khasra_no}</div><div>Status: ${field.status.replaceAll('_',' ')}</div><div>Source: field record</div></div></div>`)
            .addTo(layerGroup);
        });
    }

    // 5. Render buyer demand only where a real/explicit buyer coordinate exists.
    if (showBuyers) {
      buyers.forEach((buyer) => {
        const pos = buyer.location;
        if (!pos || !Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lng))) return;
        const icon = L.divIcon({
          html: '<div class="map-tile-icon is-wheat">🏭</div>',
          className: 'buyer-icon',
          iconSize: [27, 27],
          iconAnchor: [13.5, 13.5],
        });
        L.marker([Number(pos.lat), Number(pos.lng)], { icon })
          .bindPopup(`<div class="map-pop"><div class="map-pop-title is-wheat">${buyer.name}</div><div class="map-pop-sub">${buyer.location_name}</div><div class="map-pop-rows"><div>Demand: ${buyer.demand_tonnes.toLocaleString('en-IN')} t</div><div>Price: ₹${buyer.price_per_tonne.toLocaleString('en-IN')}/t</div></div><div class="map-pop-note">Buyer coordinates are explicit demo/reference data when present.</div></div>`)
          .addTo(layerGroup);
      });
    }

    // 6. Render authenticated weather planning signal for the selected field.
    if (showWeather && selectedField?.center && weatherPoint) {
      const pos = selectedField.center;
      const risk = weatherPoint.precipitationProbability >= 70 || weatherPoint.precipitationMm >= 8 || weatherPoint.windGustKmh >= 35;
      const icon = L.divIcon({
        html: `<div class="map-tile-icon is-round ${risk ? 'is-wheat' : 'is-green'}">☁️</div>`,
        className: 'weather-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([Number(pos.lat), Number(pos.lng)], { icon })
        .bindPopup(`<div class="map-pop"><div class="map-pop-title">Weather planning signal</div><div class="map-pop-rows"><div>${weatherPoint.temperature.toFixed(0)}°C · rain probability ${weatherPoint.precipitationProbability.toFixed(0)}%</div><div>${weatherPoint.precipitationMm.toFixed(1)} mm rain · gusts ${weatherPoint.windGustKmh.toFixed(0)} km/h</div></div><div class="map-pop-note">Planning signal only; confirm field and machine conditions before dispatch.</div></div>`)
        .addTo(layerGroup);
    }

// 4. Render Storage Yards & Buyers
    if (showYards) {
      storageYards.forEach((yard) => {
        const yardHtml = `
          <div class="map-tile-icon is-sky">🏭</div>
        `;

        const yardIcon = L.divIcon({
          html: yardHtml,
          className: 'yard-icon',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        if (!Number.isFinite(Number(yard.location?.lat)) || !Number.isFinite(Number(yard.location?.lng))) return;
        const marker = L.marker([Number(yard.location.lat), Number(yard.location.lng)], {
          icon: yardIcon,
        });

        marker.bindPopup(`
          <div class="map-pop">
            <div class="map-pop-title is-sky">${yard.name}</div>
            <div class="map-pop-rows">
            <div>Capacity: ${yard.capacity_tonnes} tonnes</div>
            <div>Current Stock: ${yard.current_load} tonnes</div>
            </div>
          </div>
        `);

        marker.addTo(layerGroup);
      });
    }

    // 7. Render Active VRP Polyline Route
    if (showRoute && activeRoutePolyline && activeRoutePolyline.length > 1) {
      const lineCoords: [number, number][] = activeRoutePolyline.map((p) => [p.lat, p.lng]);
      const routeLine = L.polyline(lineCoords, {
        color: '#f0c66e',
        weight: 4,
        opacity: 0.95,
        dashArray: '10, 8',
        lineCap: 'round',
      });
      routeLine.addTo(layerGroup);
    }
  }, [
    fields,
    machines,
    fireEvents,
    storageYards,
    buyers,
    selectedField,
    visibleFields,
    activeRoutePolyline,
    highlightFirmsFire,
    showFields,
    showMachines,
    showFires,
    showYards,
    showResidue,
    showBuyers,
    showRoute,
    showWeather,
    weatherPoint,
    animatedPositions,
    locationTimestamps,
    demoMode,
  ]);

  // Open framed on the fields instead of a fixed district-wide zoom.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || fittedRef.current || fields.length === 0) return;
    fittedRef.current = true;
    const points = fields.flatMap((field) => fieldRing(field));
    if (points.length) map.fitBounds(L.latLngBounds(points), { ...fitPadding(), maxZoom: 15 });
  }, [fields]);

  // Zoom to a field when it is picked elsewhere (list, dispatch panel, field cards).
  const lastSelectedRef = useRef<string | null>(selectedField?.id ?? null);
  useEffect(() => {
    if (!selectedField || selectedField.id === lastSelectedRef.current) return;
    lastSelectedRef.current = selectedField.id;
    const map = mapInstanceRef.current;
    if (!map) return;
    const ring = fieldRing(selectedField);
    if (ring.length >= 3) map.flyToBounds(L.latLngBounds(ring), { padding: [90, 90], maxZoom: 16, duration: 0.9 });
    else map.flyTo([selectedField.center.lat, selectedField.center.lng], 15, { duration: 0.9 });
  }, [selectedField]);

  const layerToggles: { key: string; checked: boolean; set: (value: boolean) => void; label: React.ReactNode; swatch: React.ReactNode; tone?: string }[] = [
    { key: 'fields', checked: showFields, set: setShowFields, swatch: <span className="map-swatch is-green" />, label: <span>Field polygons ({fields.length})</span> },
    { key: 'machines', checked: showMachines, set: setShowMachines, swatch: <span className="map-swatch is-dot" />, label: <span>Machines ({machines.length})</span> },
    { key: 'fires', checked: showFires, set: setShowFires, swatch: <Flame className="h-3.5 w-3.5 text-[var(--ember)]" />, label: <span className="font-semibold text-[var(--ember-ink)]">FIRMS observations ({fireEvents.length})</span>, tone: 'is-ember' },
    { key: 'yards', checked: showYards, set: setShowYards, swatch: <span className="map-swatch is-sky" />, label: <span>Yards & offtake ({storageYards.length})</span> },
    { key: 'residue', checked: showResidue, set: setShowResidue, swatch: <PackageCheck className="h-3.5 w-3.5 text-[var(--brand)]" />, label: <span>Residue lots</span> },
    { key: 'buyers', checked: showBuyers, set: setShowBuyers, swatch: <Building2 className="h-3.5 w-3.5 text-[var(--wheat-ink)]" />, label: <span>Buyer demand ({buyers.filter((buyer) => buyer.location).length} mapped)</span> },
    { key: 'weather', checked: showWeather, set: setShowWeather, swatch: <CloudSun className="h-3.5 w-3.5 text-[var(--sky)]" />, label: <span>Weather planning</span> },
    { key: 'route', checked: showRoute, set: setShowRoute, swatch: <Route className="h-3.5 w-3.5 text-[var(--wheat-ink)]" />, label: <span>Pickup route</span> },
  ];
  const activeLayerCount = layerToggles.filter((layer) => layer.checked).length;
  const clusters: [string, [number, number], number][] = [
    ['Sangrur', [30.2458, 75.8421], 12],
    ['Sunam', [30.1311, 75.8016], 13],
    ['Dhuri', [30.3683, 75.8672], 13],
    ['Bhawanigarh', [30.2766, 76.0427], 13],
  ];

  return (
    <div className="ops-map-surface map-shell relative w-full h-[540px] lg:h-[620px] overflow-hidden">
      {/* Field GIS map — the operational tracking surface. */}
      {mapError ? (
        <div className="map-error">
          <div className="max-w-md">
            <div className="map-error-title">Operational map unavailable</div>
            <p>Check your network/map tile access and reload.</p>
            <p className="map-error-detail">{mapError}</p>
          </div>
        </div>
      ) : (
        <div ref={mapContainerRef} className="w-full h-full z-0" />
      )}

      {/* GPS Live Ticker Top-Left */}
      <div className="map-gps">
        <span className="map-gps-dot" />
        <span className="map-gps-mode">{demoMode ? 'GPS DEMO' : 'GPS LIVE'}</span>
        <span className="map-gps-sep">·</span>
        <span className="map-gps-count">{machines.length} balers {demoMode ? 'simulated' : 'tracked'}</span>
        <span className="map-gps-time">Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>

      {/* Field finder Top-Left */}
      <div className="map-finder">
        <button
          type="button"
          className={`map-finder-button ${fieldListOpen ? 'is-open' : ''}`}
          onClick={() => setFieldListOpen((open) => !open)}
          aria-expanded={fieldListOpen}
        >
          <ListFilter className="h-4 w-4" />
          <span>Find a field</span>
          <span className="map-layers-count">{visibleFields.length}</span>
        </button>
        {fieldListOpen && (
          <div className="map-finder-panel">
            <div className="map-finder-search">
              <Search className="h-4 w-4" aria-hidden="true" />
              <input
                value={fieldQuery}
                onChange={(event) => setFieldQuery(event.target.value)}
                placeholder="Khasra, village or farmer"
                aria-label="Search fields on the map"
                type="search"
              />
              {fieldQuery && <button type="button" aria-label="Clear search" onClick={() => setFieldQuery('')}><X className="h-3.5 w-3.5" /></button>}
            </div>
            <ul className="map-finder-list">
              {listedFields.length === 0 ? (
                <li className="map-finder-empty">No fields match. Clear the search or turn a status back on below.</li>
              ) : listedFields.map((field) => {
                const meta = STAGE_META[fieldStage(field.status)];
                const selected = selectedField?.id === field.id;
                return (
                  <li key={field.id}>
                    <button type="button" className={`map-finder-row ${selected ? 'is-selected' : ''}`} onClick={() => focusField(field)}>
                      <span className={`map-stage-swatch ${meta.dashed ? 'is-dashed' : ''}`} style={{ '--stage': meta.fill } as React.CSSProperties} />
                      <span className="min-w-0 flex-1">
                        <strong>{field.khasra_no || field.id}</strong>
                        <small>{field.village} · {Number(field.acreage || 0).toFixed(1)} ac</small>
                      </span>
                      <span className="map-finder-stage">{meta.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Layers control Top-Right */}
      <div className="map-layers">
        <button
          type="button"
          className={`map-layers-button ${layersOpen ? 'is-open' : ''}`}
          onClick={() => setLayersOpen((open) => !open)}
          aria-expanded={layersOpen}
        >
          <Layers className="h-4 w-4" />
          <span>Satellite field map</span>
          <span className="map-layers-count">{activeLayerCount}</span>
          <ChevronDown className="h-4 w-4 map-layers-chevron" />
        </button>
        {layersOpen && (
          <div className="map-layers-panel">
            <div className="map-layers-heading">
              <Layers className="h-3.5 w-3.5" />
              <span>GIS map layers</span>
            </div>
            {layerToggles.map((layer) => (
              <label key={layer.key} className={`map-layer-row ${layer.tone || ''}`}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="map-layer-swatch">{layer.swatch}</span>
                  {layer.label}
                </span>
                <input type="checkbox" className="map-switch" checked={layer.checked} onChange={(e) => layer.set(e.target.checked)} />
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Zoom + recenter Right */}
      <div className="map-zoom">
        <button type="button" aria-label="Zoom in" onClick={() => mapInstanceRef.current?.zoomIn()}><Plus className="h-4 w-4" /></button>
        <button type="button" aria-label="Zoom out" onClick={() => mapInstanceRef.current?.zoomOut()}><Minus className="h-4 w-4" /></button>
        <button type="button" aria-label="Show all fields" title="Show all fields" onClick={() => fitToFields()}><LocateFixed className="h-4 w-4" /></button>
      </div>

      {/* Bottom: legend above the hotspot cluster shortcuts */}
      <div className="map-bottom">
        <div className="map-legend" role="group" aria-label="Field status filter">
          {FIELD_STAGES.map((stage) => {
            const meta = STAGE_META[stage];
            const on = !hiddenStages.has(stage);
            return (
              <button
                key={stage}
                type="button"
                className={`map-stage ${on ? '' : 'is-off'}`}
                aria-pressed={on}
                title={on ? `Hide ${meta.label.toLowerCase()} fields` : `Show ${meta.label.toLowerCase()} fields`}
                onClick={() => toggleStage(stage)}
              >
                <span className={`map-stage-swatch ${meta.dashed ? 'is-dashed' : ''}`} style={{ '--stage': meta.fill } as React.CSSProperties} />
                <span>{meta.label}</span>
                <b>{stageCounts[stage]}</b>
              </button>
            );
          })}
          <span className="map-stage is-static">
            <span className="map-swatch is-fire"></span>
            <span className="font-semibold text-[var(--ember-ink)]">External thermal observation</span>
          </span>
        </div>

        <div className="map-clusters">
          <span className="map-clusters-label">
            <MapPin className="w-3.5 h-3.5" />
            <span>Hotspot Clusters:</span>
          </span>
          {clusters.map(([name, center, zoom]) => (
            <button key={name} type="button" onClick={() => mapInstanceRef.current?.flyTo(center, zoom)}>
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
