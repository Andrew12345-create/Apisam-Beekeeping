// Enhanced location selection
function testAutoDetect() {
    document.getElementById('auto-detect').style.display = 'block';
    document.getElementById('map-selection').style.display = 'none';
    document.getElementById('manual-entry').style.display = 'none';
    
    document.getElementById('detected-location').innerHTML = '<p>Testing location detection...</p>';
    
    // Simulate location detection
    setTimeout(() => {
        const lat = -1.2921; // Nairobi coordinates
        const lng = 36.8219;
        
        document.getElementById('detected-location').innerHTML = `
            <p>📍 Location detected: ${lat}, ${lng} (Nairobi, Kenya)</p>
            <button onclick="confirmLocation('auto', '${lat},${lng}')" id="confirm-auto-btn">Confirm This Location</button>
        `;
        
        // Show map
        const mapEl = document.getElementById('auto-detect-map');
        mapEl.style.display = 'block';
        mapEl.innerHTML = `
            <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lng}" 
                    width="100%" height="400" frameborder="0"></iframe>
        `;
    }, 1000);
}

function initDraggableMarker() {
    const marker = document.getElementById('draggable-marker');
    const mapContainer = document.getElementById('auto-detect-map');
    const coordsDisplay = document.getElementById('marker-coords');
    
    let isDragging = false;
    
    function updateCoords(x, y) {
        const rect = mapContainer.getBoundingClientRect();
        const relativeX = (x - rect.left) / rect.width;
        const relativeY = (y - rect.top) / rect.height;
        
        const newLat = currentLocation.lat + (0.5 - relativeY) * 0.01;
        const newLng = currentLocation.lng + (relativeX - 0.5) * 0.01;
        
        currentLocation = { lat: newLat, lng: newLng };
        coordsDisplay.textContent = `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
        
        const confirmBtn = document.getElementById('confirm-auto-btn');
        if (confirmBtn) {
            confirmBtn.onclick = () => confirmLocation('auto', `${newLat},${newLng}`);
        }
    }
    
    marker.addEventListener('mousedown', function(e) {
        isDragging = true;
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            const rect = mapContainer.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
            const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
            
            marker.style.left = x + 'px';
            marker.style.top = y + 'px';
            marker.style.transform = 'translate(-50%, -50%)';
            
            updateCoords(e.clientX, e.clientY);
        }
    });
    
    document.addEventListener('mouseup', function() {
        isDragging = false;
    });
    
    updateCoords(mapContainer.getBoundingClientRect().left + mapContainer.offsetWidth/2, 
                mapContainer.getBoundingClientRect().top + mapContainer.offsetHeight/2);
}
function showMapSelection() {
    document.getElementById('auto-detect').style.display = 'none';
    document.getElementById('map-selection').style.display = 'block';
    document.getElementById('manual-entry').style.display = 'none';
    
    // Show interactive map for Kenya
    document.getElementById('map-container').innerHTML = `
        <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=33.8935,-4.6796,41.8550,5.5069&layer=mapnik" 
                width="100%" height="400" frameborder="0"></iframe>
        <div style="margin-top:10px;text-align:center;">
            <button onclick="confirmLocation('map', '-1.2921,36.8219')" style="margin:5px;padding:10px;background:#28a745;color:white;border:none;border-radius:5px;">Select Nairobi</button>
            <button onclick="confirmLocation('map', '-4.0435,39.6682')" style="margin:5px;padding:10px;background:#28a745;color:white;border:none;border-radius:5px;">Select Mombasa</button>
            <button onclick="confirmLocation('map', '0.5143,35.2697')" style="margin:5px;padding:10px;background:#28a745;color:white;border:none;border-radius:5px;">Select Eldoret</button>
        </div>
    `;
}