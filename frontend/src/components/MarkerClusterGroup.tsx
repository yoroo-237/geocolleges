import { ReactNode } from 'react'
import MarkerCluster from 'react-leaflet-cluster'

/**
 * Fine wrapper around react-leaflet-cluster (maintenu, compatible react-leaflet v4).
 */
export default function MarkerClusterGroup({ children }: { children: ReactNode }) {
  return (
    <MarkerCluster chunkedLoading showCoverageOnHover={false} maxClusterRadius={50} spiderfyOnMaxZoom>
      {children}
    </MarkerCluster>
  )
}
