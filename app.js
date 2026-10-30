// Inquiries go to Formspree: the endpoint is the form's action attribute.

(function(){
  var f = document.getElementById('inquiry');
  f.classList.add('js');
  var steps = [].slice.call(f.querySelectorAll('.step'));
  var dots = f.querySelectorAll('.progress span');
  var label = document.getElementById('stepLabel');
  var err = document.getElementById('err');
  var i = 0;
  function show(n, focus){
    i = n;
    steps.forEach(function(s, k){ s.classList.toggle('cur', k === n); });
    [].forEach.call(dots, function(d, k){ d.classList.toggle('on', k <= n); });
    label.textContent = 'Step ' + (n + 1) + ' of 3';
    if (focus) { var el = steps[n].querySelector('input,select'); if (el) el.focus(); }
  }
  function valid(s){
    var fields = s.querySelectorAll('input[required]');
    for (var k = 0; k < fields.length; k++) { if (!fields[k].checkValidity()) { fields[k].reportValidity(); return false; } }
    return true;
  }
  f.addEventListener('click', function(e){
    if (e.target.hasAttribute('data-next')) { if (valid(steps[i])) show(i + 1, true); }
    if (e.target.hasAttribute('data-back')) show(i - 1, true);
  });
  f.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && i < 2) { e.preventDefault(); if (valid(steps[i])) show(i + 1, true); }
  });
  function finish(text){
    steps.forEach(function(s){ s.classList.remove('cur'); });
    f.querySelector('.progress').hidden = true;
    var d = document.getElementById('done');
    if (text) document.getElementById('doneText').textContent = text;
    d.hidden = false; d.focus();
  }
  f.addEventListener('submit', function(e){
    e.preventDefault();
    err.hidden = true;
    if (!valid(steps[2])) return;
    var data = new FormData(f);
    data.append('_subject', 'Testing run inquiry: ' + data.get('app_name'));
    fetch(f.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then(function(r){ if (!r.ok) throw 0; finish(); })
      .catch(function(){ err.textContent = 'That didn’t go through. Check your connection and press Send again.'; err.hidden = false; });
  });
  show(0, false);

  // Hide the phone CTA bar while the hero buttons or the form are on screen
  var sticky = document.getElementById('sticky');
  if ('IntersectionObserver' in window) {
    var seen = new Set();
    var io = new IntersectionObserver(function(es){
      es.forEach(function(x){ x.isIntersecting ? seen.add(x.target) : seen.delete(x.target); });
      sticky.hidden = seen.size > 0;
    });
    io.observe(document.querySelector('.cta'));
    io.observe(document.getElementById('contact'));
  }
})();
