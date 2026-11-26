/* TEAC V2 — têtes et redressement léger, cycle 8 s, 8 images/s maximum.
   Calques visuels issus du décor sans logo ; pas de nouveaux gestes générés.
   Conserver le crédit de Marie Charlemagne. */
window.createTeacAudience = async function createTeacAudience({ canvas, image, onState = () => {} }) {
  if (!image.complete) await new Promise((resolve, reject) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', reject, { once: true });
  });
  if (!image.naturalWidth) throw new Error('Audience image unavailable');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) throw new Error('WebGL unavailable — keep the still image');
  // The same deformation is rendered behind and in front of the curtain,
  // so the original fixed silhouette never shows through a moving figure.
  const background=document.createElement('canvas');
  background.className=image.className;
  background.setAttribute('aria-hidden','true');
  background.style.pointerEvents='none';
  background.style.filter=image.style.filter;
  const backgroundContext=background.getContext('2d');
  if(!backgroundContext) throw new Error('Canvas unavailable');
  image.before(background);
  const originalOpacity=image.style.opacity;
  const lighting=new MutationObserver(()=>{background.style.filter=image.style.filter;});
  lighting.observe(image,{attributes:true,attributeFilter:['style']});
  const vertexSource = `attribute vec2 position; varying vec2 uv;
    void main(){ uv=(position+1.0)*0.5; gl_Position=vec4(position,0.0,1.0); }`;
  const fragmentSource = `precision highp float;
    varying vec2 uv; uniform sampler2D picture; uniform float seconds;
    uniform vec2 imageSize; uniform float foregroundOnly; uniform float reveal;
    float zone(vec2 p,vec2 center,vec2 radius){
      float d=length((p-center)/radius);
      return 1.0-smoothstep(0.20,1.0,d);
    }
    void main(){
      vec2 p=vec2(uv.x,1.0-uv.y);
      float t=6.28318530718*seconds/8.0;
      vec2 delta=vec2(0.0);
      // The yellow-shirt figure gently straightens as the curtain opens.
      // This is a local bend of the existing pose, not a full seated-to-standing gesture.
      float body=zone(p,vec2(0.478,0.505),vec2(0.046,0.084));
      delta+=body*vec2(1.2*sin(t),-10.0*(1.0-reveal)-1.2*(1.0-cos(t)));
      // Compact masks below the screen: never displace the architecture.
      if(p.y>0.58 && p.y<0.88){
        float a=zone(p,vec2(0.395,0.666),vec2(0.035,0.064));
        float b=zone(p,vec2(0.729,0.739),vec2(0.035,0.067));
        float c=zone(p,vec2(0.508,0.749),vec2(0.032,0.058));
        delta+=a*vec2(2.5*sin(t),1.2*(cos(t)-1.0));
        delta+=b*vec2(2.0*(sin(t+1.2)-sin(1.2)),1.0*(cos(t+1.2)-cos(1.2)));
        delta+=c*vec2(2.3*(sin(t+2.6)-sin(2.6)),1.1*(cos(t+2.6)-cos(2.6)));
      }
      vec3 original=texture2D(picture,vec2(p.x,1.0-p.y)).rgb;
      float fixedFrame=smoothstep(0.08,0.20,min(original.r,original.b)-original.g);
      if(p.y<0.58) delta*=1.0-fixedFrame;
      p+=delta/imageSize;
      vec4 ink=texture2D(picture,vec2(p.x,1.0-p.y));
      float alpha=0.0;
      if(p.y>=0.56){alpha=1.0;}
      else {
        bool raised=p.x>0.438 && p.x<0.523 && p.y>0.435;
        bool standing=p.x>0.680 && p.x<0.748 && p.y>0.435;
        if(raised||standing){
          float paper=min(ink.r,min(ink.g,ink.b));
          alpha=1.0-smoothstep(0.88,0.98,paper);
          // Exclude the original magenta frame from the people foreground.
          float magenta=smoothstep(0.08,0.20,min(ink.r,ink.b)-ink.g);
          alpha*=1.0-magenta;
        }
      }
      gl_FragColor=vec4(ink.rgb,mix(1.0,alpha,foregroundOnly));
    }`;
  const compile = (type, source) => {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message);
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource), fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.deleteShader(vertex); gl.deleteShader(fragment); gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.uniform1i(gl.getUniformLocation(program, 'picture'), 0);
  gl.uniform2f(gl.getUniformLocation(program, 'imageSize'), image.naturalWidth, image.naturalHeight);
  const time = gl.getUniformLocation(program, 'seconds');
  const foregroundUniform=gl.getUniformLocation(program,'foregroundOnly');
  const revealUniform=gl.getUniformLocation(program,'reveal');
  let reveal=0;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = true, trailer = false, sceneVisible = true, intersecting = true, destroyed = false, lost = false;
  let frame = 0, elapsed = 0, last = null;
  const draw = seconds => {
    if (destroyed || lost) return;
    const width = Math.min(1920, Math.max(1, Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 1.5))));
    const height = Math.round(width * image.naturalHeight / image.naturalWidth);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    if(background.width!==width||background.height!==height){background.width=width;background.height=height;}
    gl.viewport(0, 0, width, height); gl.uniform1f(time, seconds);
    gl.uniform1f(revealUniform,preference.matches?1:reveal);
    gl.uniform1f(foregroundUniform,0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    backgroundContext.drawImage(canvas,0,0);
    gl.uniform1f(foregroundUniform,1);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  };
  const running = () => enabled && !preference.matches && !trailer && sceneVisible && intersecting && !document.hidden && !destroyed && !lost;
  const tick = now => {
    frame = 0;
    if (!running()) return;
    if (last === null) last = now;
    // Render at no more than 8 fps; elapsed time remains continuous.
    if (now - last >= 1000 / 8) { elapsed += (now - last) / 1000; last = now; draw(Math.floor((elapsed % 8)*8)/8); }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(frame); frame = 0; last = null;
    if (destroyed) return;
    if (running()) frame = requestAnimationFrame(tick);
    onState({ enabled, running: running(), reduced: preference.matches, trailer, unavailable: lost });
  };
  const resize = new ResizeObserver(() => draw(elapsed % 8)); resize.observe(canvas);
  const observer = new IntersectionObserver(entries => { intersecting = entries[0].isIntersecting; sync(); }, { threshold: 0 }); observer.observe(canvas);
  const visibility = () => sync(); document.addEventListener('visibilitychange', visibility);
  const reduced = () => { if (preference.matches) { elapsed = 0; draw(0); } sync(); }; preference.addEventListener('change', reduced);
  const contextLost = event => { event.preventDefault(); lost = true; canvas.style.visibility = 'hidden'; background.style.visibility='hidden';image.style.opacity=originalOpacity;sync(); };
  canvas.addEventListener('webglcontextlost', contextLost);
  draw(0); image.style.opacity='0'; canvas.style.visibility = 'visible'; sync();
  return {
    setEnabled(value) { enabled = Boolean(value); sync(); },
    setTrailerPlaying(value) { trailer = Boolean(value); sync(); },
    setSceneVisible(value) { const next=Boolean(value); if(sceneVisible!==next){sceneVisible=next;sync();} },
    setReveal(value) { const next=Math.max(0,Math.min(1,Number(value)||0)); if(next!==reveal){reveal=next;draw(Math.floor((elapsed%8)*8)/8);} },
    // Manual art-direction preview: also useful for checking a seamless loop.
    previewFrame(seconds) { enabled = false; elapsed = seconds; sync(); draw(seconds % 8); },
    destroy() {
      destroyed = true; cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect();
      lighting.disconnect();background.remove();image.style.opacity=originalOpacity;
      document.removeEventListener('visibilitychange', visibility); preference.removeEventListener('change', reduced);
      canvas.removeEventListener('webglcontextlost', contextLost); canvas.style.visibility = 'hidden';
      gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program);
    }
  };
};
