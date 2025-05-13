mapboxgl.accessToken = 'pk.eyJ1IjoiZGJlcmdlcjMyNCIsImEiOiJjbTkxejI1ODYwMGQ1MmxvbWZreDZhMGgxIn0.nfxxsMs9W6jzp0-Wo-OEZg';

// Ensure Turf.js is imported
if (typeof turf === 'undefined') {
    console.error('Turf.js is not loaded. Please include Turf.js in your HTML file.');
}
// Ensure Mapbox GL JS is imported
// map bounds to NYC
const map = new mapboxgl.Map({
    container: 'map-container',
    center: [-73.99432, 40.71103],
    zoom: 9.92,
    style: 'mapbox://styles/dberger324/cmag3wj1f013801s03teu7bom',
    maxBounds: [[-74.459, 40.277], [-73.500, 41.117]],
    pitch: 20,
});

let searchMarker;
let moderateFloodData, extremeFloodData, hundredYearFloodData;

// NYC bounding box: [west, south, east, north]
const nycBbox = [-74.25909, 40.477399, -73.700181, 40.917577];

// Add the geocoder control AFTER the map is created
const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    placeholder: 'Enter your address here',
    bbox: nycBbox,
    mapboxgl: mapboxgl,
    marker: false,
    proximity: {
        longitude: -73.935242,
        latitude: 40.730610
    }
});

document.getElementById('geocoder').appendChild(geocoder.onAdd(map));

geocoder.on('result', function (e) {
    const placeName = e.result.place_name;
    document.getElementById('selected-address').textContent = placeName;

    // Optionally: scroll sidebar-interactive to the top
    document.getElementById('sidebar-interactive').scrollTop = 0;
});


// === Functions === getting flood risk status and recommendations
function getFloodRiskStatus(lngLat, moderateData, extremeData, hundredYearData) {
    const point = turf.point(lngLat);
    const buffer = turf.buffer(point, 35, { units: 'feet' });

    let inModerate = false;
    let inExtreme = false;
    let inHundredYear = false;

    moderateData.features.forEach(feature => {
        if (turf.booleanIntersects(buffer, feature)) inModerate = true;
    });

    extremeData.features.forEach(feature => {
        if (turf.booleanIntersects(buffer, feature)) inExtreme = true;
    });

    hundredYearData.features.forEach(feature => {
        if (turf.booleanIntersects(buffer, feature)) inHundredYear = true;
    });

    let status;

    if (inModerate && inHundredYear) {
        status = 'moderate-hundred';
    } else if (inExtreme && inHundredYear) {
        status = 'extreme-hundred';
    } else if (inModerate) {
        status = 'moderate';
    } else if (inExtreme) {
        status = 'extreme';
    } else if (inHundredYear) {
        status = 'hundred';
    } else {
        status = 'low-risk';
    }

    return { status, inHundredYear };
}

function getFloodRiskRec(lngLat, moderateData, extremeData, hundredYearData) {
    const point = turf.point(lngLat);
    const buffer = turf.buffer(point, 35, { units: 'feet' });

    let inModerate = false;
    let inExtreme = false;
    let inHundredYear = false;

    moderateData.features.forEach(feature => {
        if (turf.booleanIntersects(buffer, feature)) inModerate = true;
    });

    extremeData.features.forEach(feature => {
        if (turf.booleanIntersects(buffer, feature)) inExtreme = true;
    });

    hundredYearData.features.forEach(feature => {
        if (turf.booleanIntersects(buffer, feature)) inHundredYear = true;
    });

    let recommendation;

    if (inModerate && inHundredYear) {
        recommendation = 'moderate-hundred';
    } else if (inExtreme && inHundredYear) {
        recommendation = 'extreme-hundred';
    } else if (inModerate) {
        recommendation = 'moderate';
    } else if (inExtreme) {
        recommendation = 'extreme';
    } else if (inHundredYear) {
        recommendation = 'hundred';
    } else {
        recommendation = 'low-risk';
    }

    return { recommendation, inHundredYear };
}


// === Geocoder Result Handler ===
geocoder.on('result', async (e) => {
    const [lng, lat] = e.result.center;

    if (!moderateFloodData || !extremeFloodData || !hundredYearFloodData) {
        console.error('Flood data is not loaded yet.');
        document.getElementById('flood-risk-text').textContent = 'Flood data is still loading. Please try again later.';
        return;
    }

    map.flyTo({
        center: [lng, lat],
        zoom: 15,
        speed: 0.4,
        curve: 1.8,
        essential: true,
    });

    if (searchMarker) {
        searchMarker.remove();
    }

    searchMarker = new mapboxgl.Marker({ color: '#0E34A0' })
        .setLngLat([lng, lat])
        .addTo(map);

    const { status, inHundredYear } = getFloodRiskStatus([lng, lat], moderateFloodData, extremeFloodData, hundredYearFloodData);
    const { recommendation } = getFloodRiskRec([lng, lat], moderateFloodData, extremeFloodData, hundredYearFloodData);

    const spinnerHTML = '<div class="spinner"></div>';

    document.getElementById('status-content').innerHTML = spinnerHTML;
    document.getElementById('recommendation-content').innerHTML = spinnerHTML;


    try {
        const [statusHTML, recommendationHTML] = await Promise.all([
            fetch(`Text/status/${status}.html`).then(res => res.text()),
            fetch(`Text/recommendation/${recommendation}.html`).then(res => res.text())
        ]);

        document.getElementById('status-content').innerHTML = statusHTML;
        document.getElementById('recommendation-content').innerHTML = recommendationHTML;
    } catch (error) {
        console.error('Error loading sidebar content:', error);
        document.getElementById('status-content').innerHTML = `<p>Error loading status information.</p>`;
        document.getElementById('recommendation-content').innerHTML = `<p>Error loading recommendation information.</p>`;
    }
});

// Show loader immediately on page load
document.getElementById('map-loader').style.display = 'block';
// === Load GeoJSON and Add Layers === //
map.on('load', async () => {
    try {
        const moderateResponse = await fetch('Data/Moderate_Flood_WGS84_Simple.json');
        moderateFloodData = await moderateResponse.json();

        const extremeResponse = await fetch('Data/Extreme_Flood_noHighTide_Dissolved.geojson');
        extremeFloodData = await extremeResponse.json();

        const hundredYearResponse = await fetch('Data/FEMA_100_Year_Dissolved.json');
        hundredYearFloodData = await hundredYearResponse.json();

        map.addSource('moderateFlood', {
            type: 'geojson',
            data: moderateFloodData
        });

        map.addSource('extremeFlood', {
            type: 'geojson',
            data: extremeFloodData
        });

        map.addSource('HundredYearFlood', {
            type: 'geojson',
            data: hundredYearFloodData
        });

        // logging the data to check if it is loaded correctly
        console.log(moderateFloodData);
        console.log(extremeFloodData);
        console.log(hundredYearFloodData);
        console.log(moderateFloodData.features[0].geometry.coordinates);

        map.addLayer({
            id: 'extremeFloodLayer',
            type: 'fill',
            source: 'extremeFlood',
            paint: {
                'fill-color': '#fde74c',
                'fill-opacity': 0.3,
                'fill-outline-color': '#fde74c'
            }
        });

        map.addLayer({
            id: 'moderateFloodLayer',
            type: 'fill',
            source: 'moderateFlood',
            paint: {
                'fill-color': '#3399FF',
                'fill-opacity': 0.5,
                'fill-outline-color': '#3399FF'
            }
        });

        map.addLayer({
            id: 'HundredYearFloodLayer',
            type: 'fill',
            source: 'HundredYearFlood',
            paint: {
                'fill-color': '#C3423F',
                'fill-opacity': 0.2,
                'fill-outline-color': '#C3423F'
            }
        });

        map.addLayer({
            id: 'HundredYearFloodOutline',
            type: 'line',
            source: 'HundredYearFlood',
            paint: {
                'line-color': '#C3423F',
                'line-opacity': 0.6,
                'line-width': 1
            }
        });

        // Ensure 'settlement-subdivision-label' is on top of all flood layers
        map.moveLayer('settlement-subdivision-label');

        // Ensure 'road-label-simple' is above the data layers but below 'settlement-subdivision-label'
        map.moveLayer('road-label-simple', 'settlement-subdivision-label'); // Place it below settlement-subdivision-label

        // Ensure labels appear above data layers and move 'settlement-subdivision-label' first
        map.moveLayer('settlement-subdivision-label', 'HundredYearFloodOutline'); // Ensure it is above all data layers

        // === Add event listeners for checkboxes === //
        document.getElementById('toggle-moderate').addEventListener('change', (e) => {
            map.setLayoutProperty('moderateFloodLayer', 'visibility', e.target.checked ? 'visible' : 'none');
        });

        document.getElementById('toggle-extreme').addEventListener('change', (e) => {
            map.setLayoutProperty('extremeFloodLayer', 'visibility', e.target.checked ? 'visible' : 'none');
        });

        document.getElementById('toggle-hundred').checked = false;

        document.getElementById('toggle-hundred').addEventListener('change', (e) => {
            map.setLayoutProperty('HundredYearFloodLayer', 'visibility', e.target.checked ? 'visible' : 'none');
            map.setLayoutProperty('HundredYearFloodOutline', 'visibility', e.target.checked ? 'visible' : 'none');
        });

        map.setLayoutProperty('HundredYearFloodLayer', 'visibility', 'none');
        map.setLayoutProperty('HundredYearFloodOutline', 'visibility', 'none');

        // Hide loader after everything is fully added
        document.getElementById('map-loader').style.display = 'none';
    } catch (error) {
        console.error('Error loading flood data:', error);
        document.getElementById('map-loader').style.display = 'none'; // Hide anyway on error
    }
});


// === clear marker on geocoder x out === //

function resetSidebar() {
    document.getElementById('selected-address').textContent = '';
    document.getElementById('status-content').textContent = 'Search for a property on the map to see flood risk information.';
    document.getElementById('recommendation-content').textContent = 'Search for a property on the map to see flood mitigation resources.';

    if (searchMarker) {
        searchMarker.remove();
        searchMarker = null;
    }
}

let legend = document.getElementById("legend");
let inactivityTimer;
let fadeDuration = 15000; // 15 seconds of inactivity

// Function to show the legend
function showLegend() {
    legend.classList.add("visible");
    resetInactivityTimer();
}

// Function to hide the legend
function hideLegend() {
    legend.classList.remove("visible");
}

// Reset the inactivity timer
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(hideLegend, fadeDuration); // Hide after 15 seconds
}

// Function to check if screen width is mobile-sized
function isMobile() {
    return window.innerWidth <= 768;
}

// Add event listener for interactions (touchstart, click, or mousemove) for mobile screens
function addInteractionListeners() {
    if (isMobile()) {
        map.on('touchstart', function () {
            showLegend();
        });
        map.on('click', function () {
            showLegend();
        });
        map.on('mousemove', function () {
            showLegend();
        });
    }
}

// Remove interaction listeners if screen is not mobile-sized
function removeInteractionListeners() {
    map.off('touchstart');
    map.off('click');
    map.off('mousemove');
}

// On page load, check if we're on mobile size
if (isMobile()) {
    addInteractionListeners();
} else {
    removeInteractionListeners();
}

// Optionally, add resize event listener to check for screen size changes
window.addEventListener('resize', function () {
    if (isMobile()) {
        addInteractionListeners(); // Add interaction listeners when resizing to mobile
    } else {
        removeInteractionListeners(); // Remove interaction listeners when resizing to larger screen
    }
});

// === Mobile Geocoder === //
const geocoderMobile = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: 'Enter your address here',
    bbox: nycBbox,
    marker: false,
    proximity: {
        longitude: -73.935242,
        latitude: 40.730610
    }
});

// Mobile search bar
document.getElementById('geocoder-container-mobile').appendChild(geocoderMobile.onAdd(map));

// === Mobile Geocoder Result Handler ===
geocoderMobile.on('result', async (e) => {
    const [lng, lat] = e.result.center;

    if (!moderateFloodData || !extremeFloodData || !hundredYearFloodData) {
        console.error('Flood data is not loaded yet.');
        document.getElementById('flood-risk-text').textContent = 'Flood data is still loading. Please try again later.';
        return;
    }

    map.flyTo({
        center: [lng, lat],
        zoom: 15,
        speed: 0.4,
        curve: 1.8,
        essential: true,
    });

    if (searchMarker) {
        searchMarker.remove();
    }

    searchMarker = new mapboxgl.Marker({ color: '#0E34A0' })
        .setLngLat([lng, lat])
        .addTo(map);

    const { status, inHundredYear } = getFloodRiskStatus([lng, lat], moderateFloodData, extremeFloodData, hundredYearFloodData);
    const { recommendation } = getFloodRiskRec([lng, lat], moderateFloodData, extremeFloodData, hundredYearFloodData);

    const spinnerHTML = '<div class="spinner"></div>';

    document.getElementById('status-content').innerHTML = spinnerHTML;
    document.getElementById('recommendation-content').innerHTML = spinnerHTML;


    try {
        const [statusHTML, recommendationHTML] = await Promise.all([
            fetch(`Text/status/${status}.html`).then(res => res.text()),
            fetch(`Text/recommendation/${recommendation}.html`).then(res => res.text())
        ]);

        // Insert into mobile popup
        document.getElementById('mobile-popup-status').innerHTML = statusHTML;
        document.getElementById('mobile-popup-recommendation').innerHTML = recommendationHTML;

        // Show popup
        const popup = document.getElementById('mobile-popup');
        popup.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading popup content:', error);
        document.getElementById('mobile-popup-status').innerHTML = `<p>Error loading status.</p>`;
        document.getElementById('mobile-popup-recommendation').innerHTML = `<p>Error loading recommendation.</p>`;
    }

});
// === Mobile Popup Close Button === //
document.getElementById('mobile-popup-close').addEventListener('click', () => {
    document.getElementById('mobile-popup').classList.add('hidden');
});


// === Clear Marker on Geocoder (search bar) Clear === //
geocoder.on('clear', function () {
    resetSidebar();
});

// === Clear Marker on Map Click === //
map.on('click', () => {
    if (searchMarker) {
        searchMarker.remove();
        searchMarker = null;
    }
    document.getElementById('status-content').textContent = 'Search for a property on the map to see flood risk information.';
    document.getElementById('recommendation-content').textContent = 'Search for a property on the map to see flood mitigation resources.';
});

map.on('click', function () {
    resetSidebar();
});

// === Fade out banner on interaction === //

let bannerFaded = false;

function fadeOutBanner() {
    if (!bannerFaded) {
        const bannerWrapper = document.getElementById('banner-text-wrapper');
        if (bannerWrapper) {
            bannerWrapper.style.transition = 'opacity 1.5s ease-in-out';
            bannerWrapper.style.opacity = '0';
            bannerFaded = true;
        }
    }
}

// Trigger on any interaction
function setupBannerFadeOnInteraction() {
    ['click', 'drag', 'touchstart', 'scroll', 'keydown'].forEach(eventType => {
        window.addEventListener(eventType, fadeOutBanner, { once: true });
    });
}

setupBannerFadeOnInteraction();
