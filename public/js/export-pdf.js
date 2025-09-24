// Replace previous capture-based implementation with server-driven pdf request
(function(){
  document.addEventListener('click', function(e){
    if (e.target && e.target.id === 'exportPdfBtn') {
      const btn = e.target;
      btn.disabled = true;
      try {
        const code = btn.dataset.code || '';
        if (!code) {
          alert('ไม่พบรหัสสถาบันเพื่อส่งออก PDF');
          btn.disabled = false;
          return;
        }
        // open a blank window synchronously to avoid popup block
        const newWin = window.open('', '_blank');
        const url = `/chamra/detail/${encodeURIComponent(code)}/export/pdf`;
        // navigate the opened window to the PDF URL
        if (newWin) {
          newWin.location.href = url;
        } else {
          // fallback: try opening in new tab directly
          const opened = window.open(url, '_blank');
          if (!opened) {
            alert('ไม่สามารถเปิดแท็บใหม่ได้ กรุณาอนุญาตป๊อปอัปหรือดาวน์โหลดด้วยตนเอง');
          }
        }
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการส่งคำขอ PDF');
      } finally {
        btn.disabled = false;
      }
    }
  });
})();
