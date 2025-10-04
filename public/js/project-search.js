(function(){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  function init(){
    try {
      var form = document.querySelector('form[action=""], form[action="/project"]');
      if (!form) return;
      var input = form.querySelector('input[name="search"]');
      if (!input) return;

      // Submit with debounce while typing
      var timer;
      input.addEventListener('input', function(){
        clearTimeout(timer);
        var val = input.value.trim();
        timer = setTimeout(function(){
          if (val.length === 0 || val.length >= 2) {
            form.requestSubmit ? form.requestSubmit() : form.submit();
          }
        }, 450);
      });

      // ESC to clear and navigate back to base list
      input.addEventListener('keydown', function(e){
        if (e.key === 'Escape') {
          e.preventDefault();
          input.value = '';
          window.location.href = '/project';
        }
      });
    } catch(e) { /* noop */ }
  }
})();

