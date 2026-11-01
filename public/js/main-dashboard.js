(function () {
    var loginModal = document.getElementById('mainLoginModal');
    if (loginModal) {
      loginModal.addEventListener('shown.bs.modal', function () {
        var username = loginModal.querySelector('[name="username"]');
        if (username) username.focus();
      });
    }

    var { institutionSummary, institutionChartData, turnoverChartData, turnoverTotalAmount } = window.mainDashboardData;
    var modalEl = document.getElementById('institutionSummaryModal');
    var titleEl = document.getElementById('institutionSummaryModalTitle');
    var subtitleEl = document.getElementById('institutionSummaryModalSubtitle');
    var rowsEl = document.getElementById('institutionSummaryModalRows');
    var chartCanvas = document.getElementById('institutionSummaryChart');
    var chartFallback = document.getElementById('institutionSummaryChartFallback');
    var turnoverAmountCanvas = document.getElementById('turnoverAmountChart');
    var turnoverAmountFallback = document.getElementById('turnoverAmountChartFallback');

    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function formatNumber(value, digits) {
      return Number(value || 0).toLocaleString('th-TH', {
        minimumFractionDigits: digits || 0,
        maximumFractionDigits: digits || 0
      });
    }

    function formatMillionBaht(value) {
      return formatNumber(Number(value || 0) / 1000000, 2) + ' ล้านบาท';
    }

    function formatCompactMillionBaht(value) {
      return formatNumber(Number(value || 0) / 1000000) + ' ลบ.';
    }

    function makeChart(canvas, fallback, hasVisibleData, configFactory) {
      function showFallback() {
        if (canvas) canvas.hidden = true;
        if (fallback) fallback.hidden = false;
      }

      if (!canvas || !fallback) return;
      if (!hasVisibleData || typeof Chart === 'undefined') {
        showFallback();
        return;
      }

      try {
        new Chart(canvas.getContext('2d'), configFactory());
      } catch (error) {
        showFallback();
      }
    }

    if (!modalEl || !titleEl || !subtitleEl || !rowsEl) return;

    modalEl.addEventListener('show.bs.modal', function(event) {
      var trigger = event.relatedTarget;
      var type = trigger ? trigger.getAttribute('data-institution-type') : '';
      var data = institutionSummary[type] || { label: 'รายชื่อสถาบัน', rows: [], count: 0 };
      var rows = Array.isArray(data.rows) ? data.rows : [];

      titleEl.textContent = data.label || 'รายชื่อสถาบัน';
      subtitleEl.textContent = 'จำนวน ' + rows.length + ' แห่ง';

      if (!rows.length) {
        rowsEl.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">ไม่มีข้อมูลสถาบันในประเภทนี้</td></tr>';
        return;
      }

      rowsEl.innerHTML = rows.map(function(row) {
        return [
          '<tr>',
            '<td><span class="badge text-bg-light text-secondary main-table-code">' + escapeHtml(row.c_code || '-') + '</span></td>',
            '<td class="main-institution-name">' + escapeHtml(row.c_name || '-') + '</td>',
            '<td>' + escapeHtml(row.c_group || '-') + '</td>',
            '<td><span class="badge text-bg-success">' + escapeHtml(row.accountingYearLabel || '-') + '</span></td>',
          '</tr>'
        ].join('');
      }).join('');
    });

    window.addEventListener('load', function() {
      var chartRows = Array.isArray(institutionChartData) ? institutionChartData : [];
      var turnoverRows = Array.isArray(turnoverChartData) ? turnoverChartData : [];
      var hasVisibleData = chartRows.some(function(item) {
        return Number(item.count || 0) > 0;
      });
      var hasTurnoverData = turnoverRows.some(function(item) {
        return Number(item.totalAmount || 0) > 0;
      });

      try {
        var plugins = [];
        if (typeof ChartDataLabels !== 'undefined') {
          Chart.register(ChartDataLabels);
          plugins.push(ChartDataLabels);
        }

        Chart.defaults.font.family = 'Sarabun, system-ui, -apple-system, Segoe UI, sans-serif';
        Chart.defaults.color = '#172033';

        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var values = chartRows.map(function(item) { return Number(item.count || 0); });
        var maxValue = Math.max.apply(null, values);
        var turnoverValues = turnoverRows.map(function(item) { return Number(item.totalAmount || 0); });
        var turnoverMaxValue = Math.max.apply(null, turnoverValues);

        makeChart(chartCanvas, chartFallback, hasVisibleData, function() {
          return {
          type: 'bar',
          data: {
            labels: chartRows.map(function(item) { return item.label; }),
            datasets: [{
              label: 'จำนวนสถาบัน',
              data: values,
              backgroundColor: chartRows.map(function(item) { return item.color; }),
              borderWidth: 0,
              borderRadius: 8,
              borderSkipped: false,
              barThickness: 26,
              maxBarThickness: 32
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: reduceMotion ? 0 : 320,
              easing: 'easeOutQuart'
            },
            layout: {
              padding: { top: 4, right: 26, bottom: 0, left: 0 }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return 'จำนวน ' + Number(context.parsed.x || 0).toLocaleString('th-TH') + ' แห่ง';
                  }
                }
              },
              datalabels: {
                anchor: 'end',
                align: 'right',
                clamp: true,
                color: '#172033',
                font: { weight: '700', size: 12 },
                formatter: function(value) {
                  return Number(value || 0).toLocaleString('th-TH');
                }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                suggestedMax: Math.max(maxValue + 5, Math.ceil(maxValue * 1.16)),
                grid: { color: '#edf1f6' },
                border: { display: false },
                ticks: {
                  precision: 0,
                  color: '#667085',
                  callback: function(value) {
                    return Number(value).toLocaleString('th-TH');
                  }
                }
              },
              y: {
                grid: { display: false },
                border: { display: false },
                ticks: {
                  color: '#172033',
                  font: { weight: '700', size: 12 }
                }
              }
            }
          },
          plugins: plugins
        };
        });

        makeChart(turnoverAmountCanvas, turnoverAmountFallback, hasTurnoverData, function() {
          return {
            type: 'bar',
            data: {
              labels: turnoverRows.map(function(item) { return item.label; }),
              datasets: [{
                label: 'ปริมาณธุรกิจ',
                data: turnoverValues,
                backgroundColor: turnoverRows.map(function(item) { return item.color; }),
                borderWidth: 0,
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 28,
                maxBarThickness: 36
              }]
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              animation: {
                duration: reduceMotion ? 0 : 320,
                easing: 'easeOutQuart'
              },
              layout: {
                padding: { top: 4, right: 42, bottom: 0, left: 0 }
              },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return formatMillionBaht(context.parsed.x || 0);
                    }
                  }
                },
                datalabels: {
                  anchor: 'end',
                  align: 'right',
                  clamp: true,
                  color: '#172033',
                  font: { weight: '700', size: 12 },
                  formatter: function(value) {
                    return formatCompactMillionBaht(value);
                  }
                }
              },
              scales: {
                x: {
                  beginAtZero: true,
                  suggestedMax: Math.max(turnoverMaxValue * 1.18, turnoverMaxValue + 1),
                  grid: { color: '#edf1f6' },
                  border: { display: false },
                  ticks: {
                    color: '#667085',
                    callback: function(value) {
                      return formatNumber(Number(value || 0) / 1000000) + ' ลบ.';
                    }
                  }
                },
                y: {
                  grid: { display: false },
                  border: { display: false },
                  ticks: {
                    color: '#172033',
                    font: { weight: '700', size: 12 }
                  }
                }
              }
            },
            plugins: plugins
          };
        });

      } catch (error) {
        [chartCanvas, turnoverAmountCanvas].forEach(function(canvas) {
          if (canvas) canvas.hidden = true;
        });
        [chartFallback, turnoverAmountFallback].forEach(function(fallback) {
          if (fallback) fallback.hidden = false;
        });
      }
    });
  })();
