(function () {
  'use strict';

  var section = document.getElementById('cooperativeMapSection');
  if (!section) return;

  var locations = JSON.parse(document.getElementById('cooperativeMapData').textContent);
  var mapElement = document.getElementById('cooperativeMap');
  var mapWrap = document.getElementById('cooperativeMapWrap');
  var search = document.getElementById('cooperativeMapSearch');
  var district = document.getElementById('cooperativeMapDistrict');
  var reset = document.getElementById('cooperativeMapReset');
  var empty = document.getElementById('cooperativeMapEmpty');
  var count = document.getElementById('cooperativeMapCount');
  var resultCount = document.getElementById('cooperativeMapResultCount');
  var filters = Array.from(section.querySelectorAll('[data-map-filter]'));
  var results = Array.from(section.querySelectorAll('[data-map-result]'));
  var colors = { agri: '#16845f', non_agri: '#3478c7', farmer: '#bd7410' };
  var labels = { agri: 'สหกรณ์ภาคการเกษตร', non_agri: 'สหกรณ์นอกภาคการเกษตร', farmer: 'กลุ่มเกษตรกร' };
  var selectedType = 'all';
  var map;
  var markerLayer;
  var markers = new Map();
  var initialized = false;
  var visible = [];

  function popupContent(item) {
    var box = document.createElement('div');
    box.className = 'main-coop-map-popup';
    var name = document.createElement('strong');
    name.textContent = item.name;
    box.appendChild(name);
    var detail = document.createElement('span');
    detail.textContent = labels[item.type] + (item.district ? ' · อำเภอ' + item.district : '');
    box.appendChild(detail);
    if (item.address) {
      var address = document.createElement('span');
      address.textContent = item.address;
      box.appendChild(address);
    }
    var actions = document.createElement('div');
    actions.className = 'main-coop-map-popup-actions';
    var links = [{
      url: item.googleMapsUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.latitude + ',' + item.longitude),
      label: 'เปิด Google Maps'
    }];
    if (item.websiteUrl) links.push({ url: item.websiteUrl, label: 'เยี่ยมชมเว็บไซต์' });
    links.forEach(function (item) {
      var link = document.createElement('a');
      link.className = 'main-coop-map-popup-link';
      link.href = item.url;
      link.textContent = item.label;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      actions.appendChild(link);
    });
    box.appendChild(actions);
    return box;
  }

  function renderMarkers() {
    if (!map) return;
    markerLayer.clearLayers();
    var bounds = [];
    visible.forEach(function (index) {
      var item = locations[index];
      var point = [item.latitude, item.longitude];
      if (!markers.has(index)) {
        var marker = window.L.circleMarker(point, {
          radius: 8, color: '#ffffff', weight: 2,
          className: 'main-coop-map-marker', fillColor: colors[item.type], fillOpacity: .92
        });
        marker.bindPopup(popupContent(item));
        // Leaflet interprets string tooltips as HTML, so always use a text node.
        var tooltip = document.createElement('span');
        tooltip.textContent = item.name;
        marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -7] });
        markers.set(index, marker);
      }
      markers.get(index).addTo(markerLayer);
      bounds.push(point);
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 12, animate: false });
    else if (bounds.length === 1) map.setView(bounds[0], 13, { animate: false });
    else map.setView([15.8068, 102.0315], 8, { animate: false });
  }

  function render() {
    var query = search.value.trim().toLocaleLowerCase('th');
    visible = [];
    locations.forEach(function (item, index) {
      var matches = (selectedType === 'all' || item.type === selectedType)
        && (!district.value || item.district === district.value)
        && (!query || [item.name, item.code, item.address, item.district].join(' ').toLocaleLowerCase('th').includes(query));
      results[index].hidden = !matches;
      if (matches) visible.push(index);
    });
    filters.forEach(function (button) {
      var active = button.dataset.mapFilter === selectedType;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    count.textContent = visible.length.toLocaleString('th-TH');
    resultCount.textContent = 'พบ ' + visible.length.toLocaleString('th-TH') + ' จาก ' + locations.length.toLocaleString('th-TH') + ' แห่งที่เผยแพร่';
    empty.hidden = visible.length > 0;
    if (!visible.length) {
      empty.textContent = section.dataset.unavailable === 'true'
        ? 'ข้อมูลที่ตั้งไม่พร้อมใช้งานชั่วคราว'
        : locations.length
          ? 'ไม่พบที่ตั้งตามตัวกรอง ลองเปลี่ยนคำค้นหรือกดดูทั้งหมด'
          : 'ยังไม่มีพิกัดที่เผยแพร่ เมื่อเจ้าหน้าที่ตรวจสอบและเผยแพร่ข้อมูลแล้ว จุดที่ตั้งจะแสดงบนแผนที่นี้';
    }
    renderMarkers();
  }

  function initializeMap() {
    if (initialized) return;
    initialized = true;
    if (!window.L) {
      mapWrap.classList.add('map-error');
      return;
    }
    map = window.L.map(mapElement, { scrollWheelZoom: false }).setView([15.8068, 102.0315], 8);
    var tileError = document.getElementById('cooperativeMapTileError');
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).on('tileerror', function () {
      tileError.hidden = false;
    }).on('load', function () {
      tileError.hidden = !mapElement.querySelector('.leaflet-tile:not(.leaflet-tile-loaded)');
    }).addTo(map);
    markerLayer = window.L.layerGroup().addTo(map);
    section.querySelectorAll('[data-map-location]').forEach(function (button) { button.hidden = false; });
    renderMarkers();
  }

  [search, district, reset].concat(filters).forEach(function (control) { control.disabled = false; });
  search.addEventListener('input', render);
  district.addEventListener('change', render);
  filters.forEach(function (button) {
    button.addEventListener('click', function () {
      selectedType = button.dataset.mapFilter;
      render();
    });
  });
  reset.addEventListener('click', function () {
    search.value = '';
    district.value = '';
    selectedType = 'all';
    render();
  });
  section.querySelectorAll('[data-map-location]').forEach(function (button) {
    button.addEventListener('click', function () {
      initializeMap();
      var index = Number(button.dataset.mapLocation);
      var marker = markers.get(index);
      if (!map || !marker) return;
      map.setView([locations[index].latitude, locations[index].longitude], 15, { animate: false });
      marker.openPopup();
      mapElement.scrollIntoView({ block: 'nearest' });
      mapElement.focus({ preventScroll: true });
    });
  });

  render();
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      observer.disconnect();
      initializeMap();
    }, { rootMargin: '250px' });
    observer.observe(mapElement);
  } else {
    initializeMap();
  }
})();
