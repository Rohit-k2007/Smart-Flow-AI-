import { MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet'
import { Card } from '../common/UI'
import type { TrafficFlowItem } from '../../types/api'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function pointCoordinates(value: unknown): [number, number] | null {
  const point = asRecord(value)
  if (point && typeof point.lat === 'number' && typeof point.lng === 'number') {
    return [point.lat, point.lng]
  }
  if (Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    return [value[1], value[0]]
  }
  return null
}

function lineCoordinates(geometry: unknown): [number, number][][] {
  const shape = asRecord(geometry)
  if (shape && Array.isArray(shape.links)) {
    return shape.links.flatMap((link) => {
      const points = asRecord(link)?.points
      return Array.isArray(points)
        ? [points.map(pointCoordinates).filter((point): point is [number, number] => point !== null)]
        : []
    }).filter((line) => line.length > 1)
  }
  if (shape && shape.type === 'LineString' && Array.isArray(shape.coordinates)) {
    const line = shape.coordinates.map(pointCoordinates).filter((point): point is [number, number] => point !== null)
    return line.length > 1 ? [line] : []
  }
  if (shape && shape.type === 'MultiLineString' && Array.isArray(shape.coordinates)) {
    return shape.coordinates.flatMap((segment) => {
      if (!Array.isArray(segment)) return []
      const line = segment.map(pointCoordinates).filter((point): point is [number, number] => point !== null)
      return line.length > 1 ? [line] : []
    })
  }
  return []
}

function jamColor(jamFactor: number | null): string {
  if (jamFactor === null) return '#8da2b5'
  if (jamFactor >= 7) return '#ef6a76'
  if (jamFactor >= 4) return '#f1b84b'
  return '#48c78e'
}

export function TrafficMapPanel({ items }: { items: TrafficFlowItem[] }) {
  return (
    <Card className="data-panel">
      <div className="panel-title">HERE road segment flow · Jaipur</div>
      <MapContainer center={[26.9124, 75.7873]} zoom={12} scrollWheelZoom className="leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {items.flatMap((item, index) => lineCoordinates(item.road_geometry).map((line, lineIndex) => (
          <Polyline
            key={`${item.road_segment_reference ?? 'road'}-${index}-${lineIndex}`}
            positions={line}
            pathOptions={{ color: jamColor(item.jam_factor), weight: 5, opacity: .8 }}
          >
            <Popup>
              <strong>Road segment {item.road_segment_reference ?? 'reference unavailable'}</strong>
              <br />Current speed: {item.speed_kph === null ? 'Not supplied' : `${item.speed_kph} km/h`}
              <br />Free-flow speed: {item.free_flow_speed_kph === null ? 'Not supplied' : `${item.free_flow_speed_kph} km/h`}
              <br />HERE jam factor: {item.jam_factor ?? 'Not supplied'}
              <br />Provider updated: {item.provider_timestamp ?? 'Not supplied'}
            </Popup>
          </Polyline>
        )))}
      </MapContainer>
      <div className="map-legend">
        <span><i className="low" />Jam 0–3.9</span><span><i className="medium" />Jam 4–6.9</span><span><i className="high" />Jam 7–10</span>
        <span>No HERE geometry: {items.filter((item) => lineCoordinates(item.road_geometry).length === 0).length}</span>
      </div>
    </Card>
  )
}
