<script lang="ts">
  import type { LatLngTuple, Map } from 'leaflet';
  import markerRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
  import markerUrl from 'leaflet/dist/images/marker-icon.png';
  import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

  import 'leaflet/dist/leaflet.css';
  import { onMount } from 'svelte';

  const location: LatLngTuple = [60.2013724, 24.9653266];
  let container: HTMLDivElement;
  let loadFailed = $state(false);

  onMount(() => {
    let disposed = false;
    let map: Map | undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    void import('leaflet')
      .then(({ control, icon, map: createMap, marker, tileLayer }) => {
        if (disposed) {
          return;
        }
        map = createMap(container, {
          fadeAnimation: !reduceMotion,
          markerZoomAnimation: !reduceMotion,
          scrollWheelZoom: false,
          zoomAnimation: !reduceMotion,
          zoomControl: false,
        }).setView(location, 17);

        control.zoom({ zoomInTitle: 'Zooma in', zoomOutTitle: 'Zooma ut' }).addTo(map);
        tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
          maxZoom: 19,
        }).addTo(map);
        marker(location, {
          alt: 'Arcada',
          icon: icon({
            iconAnchor: [12, 41],
            iconRetinaUrl: markerRetinaUrl,
            iconSize: [25, 41],
            iconUrl: markerUrl,
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
            shadowUrl,
          }),
          title: 'Yrkeshögskolan Arcada',
        })
          .addTo(map)
          .bindPopup('Yrkeshögskolan Arcada');
      })
      .catch(() => {
        if (!disposed) {
          map?.remove();
          map = undefined;
          loadFailed = true;
        }
      });

    return () => {
      disposed = true;
      map?.remove();
    };
  });
</script>

<div class="map" bind:this={container}>
  {#if loadFailed}
    <p>Kartan kunde inte laddas.</p>
  {/if}
</div>

<style>
  .map {
    width: 100%;
    height: 100%;
  }

  p {
    margin: 1rem;
  }
</style>
