
let jsr = 0x5EED;
let {PI} = Math;
function rand(){
  jsr^=(jsr<<17);
  jsr^=(jsr>>13);
  jsr^=(jsr<<5);
  return (jsr>>>0)/4294967295;
}

var PERLIN_YWRAPB = 4; var PERLIN_YWRAP = 1<<PERLIN_YWRAPB;
var PERLIN_ZWRAPB = 8; var PERLIN_ZWRAP = 1<<PERLIN_ZWRAPB;
var PERLIN_SIZE = 4095;
var perlin_octaves = 4;var perlin_amp_falloff = 0.5;
var scaled_cosine = function(i) {return 0.5*(1.0-Math.cos(i*PI));};
var perlin;
let noise = function(x,y,z) {
  y = y || 0; z = z || 0;
  if (perlin == null) {
    perlin = new Array(PERLIN_SIZE + 1);
    for (var i = 0; i < PERLIN_SIZE + 1; i++) {
      perlin[i] = rand();
    }
  }
  if (x<0) { x=-x; } if (y<0) { y=-y; } if (z<0) { z=-z; }
  var xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
  var xf = x - xi; var yf = y - yi; var zf = z - zi;
  var rxf, ryf;
  var r=0; var ampl=0.5;
  var n1,n2,n3;
  for (var o=0; o<perlin_octaves; o++) {
    var of=xi+(yi<<PERLIN_YWRAPB)+(zi<<PERLIN_ZWRAPB);
    rxf = scaled_cosine(xf); ryf = scaled_cosine(yf);
    n1  = perlin[of&PERLIN_SIZE];
    n1 += rxf*(perlin[(of+1)&PERLIN_SIZE]-n1);
    n2  = perlin[(of+PERLIN_YWRAP)&PERLIN_SIZE];
    n2 += rxf*(perlin[(of+PERLIN_YWRAP+1)&PERLIN_SIZE]-n2);
    n1 += ryf*(n2-n1);
    of += PERLIN_ZWRAP;
    n2  = perlin[of&PERLIN_SIZE];
    n2 += rxf*(perlin[(of+1)&PERLIN_SIZE]-n2);
    n3  = perlin[(of+PERLIN_YWRAP)&PERLIN_SIZE];
    n3 += rxf*(perlin[(of+PERLIN_YWRAP+1)&PERLIN_SIZE]-n3);
    n2 += ryf*(n3-n2);
    n1 += scaled_cosine(zf)*(n2-n1);
    r += n1*ampl;
    ampl *= perlin_amp_falloff;
    xi<<=1; xf*=2; yi<<=1; yf*=2; zi<<=1; zf*=2;
    if (xf>=1.0) { xi++; xf--; }
    if (yf>=1.0) { yi++; yf--; }
    if (zf>=1.0) { zi++; zf--; }
  }
  return r;
};

function dist(x0,y0,x1,y1){
  return Math.hypot(x1-x0,y1-y0);
}

function lerp(a,b,t){
  return a * (1-t) + b * t;
}

function lerp2d(x0,y0,x1,y1,t){
  return [
    x0*(1-t) + x1*t,
    y0*(1-t) + y1*t,
  ]
}

function get_bbox(points){
  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity
  for (let i = 0;i < points.length; i++){
    let [x,y] = points[i];
    xmin = Math.min(xmin,x);
    ymin = Math.min(ymin,y);
    xmax = Math.max(xmax,x);
    ymax = Math.max(ymax,y);
  }
  return {x:xmin,y:ymin,w:xmax-xmin,h:ymax-ymin};
}

function seg_isect(p0x, p0y, p1x, p1y, q0x, q0y, q1x, q1y, is_ray = false) {
  let d0x = p1x - p0x;
  let d0y = p1y - p0y;
  let d1x = q1x - q0x;
  let d1y = q1y - q0y;
  let vc = d0x * d1y - d0y * d1x;
  if (vc == 0) {
    return null;
  }
  let vcn = vc * vc;
  let q0x_p0x = q0x - p0x;
  let q0y_p0y = q0y - p0y;
  let vc_vcn = vc / vcn;
  let t = (q0x_p0x * d1y - q0y_p0y * d1x) * vc_vcn;
  let s = (q0x_p0x * d0y - q0y_p0y * d0x) * vc_vcn;
  if (0 <= t && (is_ray || t < 1) && 0 <= s && s < 1) {
    let ret = {t, s, side: null, other: null, xy: null};
    ret.xy = [p1x * t + p0x * (1 - t), p1y * t + p0y * (1 - t)];
    ret.side = pt_in_pl(p0x, p0y, p1x, p1y, q0x, q0y) < 0 ? 1 : -1;
    return ret;
  }
  return null;
}

function pt_in_pl(x, y, x0, y0, x1, y1) {
  let dx = x1 - x0;
  let dy = y1 - y0;
  let e = (x - x0) * dy - (y - y0) * dx;
  return e;
}

function poly_bridge(poly0,poly1){
  let dmin = Infinity;
  let imin = null;
  for (let i = 0; i < poly0.length; i++){
    for (let j = 0; j < poly1.length; j++){
      let [x0,y0] = poly0[i];
      let [x1,y1] = poly1[j];
      let dx = x0-x1;
      let dy = y0-y1;
      let d2 = dx*dx + dy*dy;
      if (d2 < dmin){
        dmin = d2;
        imin = [i,j];
      }
    }
  }
  let u = poly0.slice(0,imin[0]).concat(
    poly1.slice(imin[1])).concat(
      poly1.slice(0,imin[1])).concat(
        poly0.slice(imin[0]));
  return u;
}

function poly_union(poly0,poly1,self_isect=false){
  let verts0 = poly0.map(xy=>({xy, isects: [], isects_map: {}}));
  let verts1 = poly1.map(xy=>({xy, isects: [], isects_map: {}}));

  function pair_key() {
    return Array.from(arguments).join(',');
  }

  let has_isect = false;

  function build_vertices(poly,other,out,oout,idx){
    let n = poly.length;
    let m = other.length;
    if (self_isect){
      for (let i = 0; i < n; i++) {
        let id = pair_key(idx,i);
        let p = out[i];
        let i1 = (i + 1 + n) % n;
        let a = poly[i];
        let b = poly[i1];
        for (let j = 0; j < n; j++) {
          let jd = pair_key(idx,j);
          let j1 = (j + 1 + n) % n;
          if (i == j || i == j1 || i1 == j || i1 == j1) {
            continue;
          }
          let c = poly[j];
          let d = poly[j1];
          let xx;
          let ox = out[j].isects_map[id];
          if (ox) {
            xx = {
              t: ox.s,
              s: ox.t,
              xy: ox.xy,
              other: null,
              side: pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1
            };
          }else{
            xx = seg_isect(...a, ...b, ...c, ...d);
          }
          if (xx) {
            xx.other = j;
            xx.jump = false;
            p.isects.push(xx);
            p.isects_map[jd] = xx;
          }
        }
        
      }
    }

    for (let i = 0; i < n; i++) {
      let id = pair_key(idx,i);
      let p = out[i];
      let i1 = (i + 1 + n) % n;
      let a = poly[i];
      let b = poly[i1];
      for (let j = 0; j < m; j++) {
        let jd = pair_key(1-idx,j);
        let j1 = (j + 1 + m) % m;
        let c = other[j];
        let d = other[j1];
        let xx;

        let ox = oout[j].isects_map[id];
        if (ox) {
          xx = {
            t: ox.s,
            s: ox.t,
            xy: ox.xy,
            other: null,
            side: pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1
          };
        } else {
          xx = seg_isect(...a, ...b, ...c, ...d);
        }
        if (xx) {
          has_isect = true;
          xx.other = j;
          xx.jump = true;
          p.isects.push(xx);
          p.isects_map[jd] = xx;
        }
      }
      p.isects.sort((a2, b2) => a2.t - b2.t);
    }
  }
  build_vertices(poly0,poly1,verts0,verts1,0);
  build_vertices(poly1,poly0,verts1,verts0,1);
  
  if (!has_isect){
    if (!self_isect){
      return poly_bridge(poly0,poly1);
    }else{
      return poly_union(poly_bridge(poly0,poly1),[],true);
    }
  }


  let isect_mir = {};
  function mirror_isects(verts0,verts1,idx) {
    let n = verts0.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < verts0[i].isects.length; j++) {
        let id = pair_key(idx, i, j);
        let {jump} = verts0[i].isects[j];
        let jd = jump?(1-idx):idx;
        let k = verts0[i].isects[j].other;
        let z = (jump?verts1:verts0)[k].isects.findIndex((x) => (x.jump == jump && x.other == i));
        isect_mir[id] = [jd, k, z];
      }
    }
  }
  mirror_isects(verts0,verts1,0);
  mirror_isects(verts1,verts0,1);

  // console.log(verts0,verts1)

  function trace_outline(idx, i0, j0, dir) {
    let zero = null;
    let out = [];
    function trace_from(idx, i0, j0, dir) {
      if (zero == null) {
        zero = [idx, i0, j0];
      } else if (idx == zero[0] && i0 == zero[1] && j0 == zero[2]) {
        return true;
      }
      let verts = idx?verts1:verts0;
      let n = verts.length;
      let p = verts[i0];
      let i1 = (i0 + dir + n) % n;
      if (j0 == -1) {
        out.push(p.xy);
        if (dir < 0) {
          return trace_from(idx,i1, verts[i1].isects.length - 1, dir);
        } else if (!verts[i0].isects.length) {
          return trace_from(idx, i1, -1, dir, [i0, j0]);
        } else {
          return trace_from(idx, i0, 0, dir, [i0, j0]);
        }
      } else if (j0 >= p.isects.length) {
        return trace_from(idx, i1, -1, dir, [i0, j0]);
      } else {
        let id = pair_key(idx, i0, j0);
        out.push(p.isects[j0].xy);

        let q = p.isects[j0];
        let [jdx, k, z] = isect_mir[id];
        let params;
        if (q.side * dir < 0) {
          params = [jdx, k, z - 1, -1];
        } else {
          params = [jdx, k, z + 1, 1];
        }
        return trace_from(...params);
      }
    }
    let success = trace_from(idx, i0, j0, dir);
    if (!success || out.length < 3) {
      return null;
    }
    return out;
  }

  let xmin = Infinity;
  let amin = null;
  for (let i = 0; i < poly0.length; i++) {
    if (poly0[i][0] < xmin) {
      xmin = poly0[i][0];
      amin = [0,i];
    }
  }
  for (let i = 0; i < poly1.length; i++) {
    if (poly1[i][0] < xmin) {
      xmin = poly1[i][0];
      amin = [1,i];
    }
  }

  function check_concavity(poly, idx) {
    let n = poly.length;
    let a = poly[(idx - 1 + n) % n];
    let b = poly[idx];
    let c = poly[(idx + 1) % n];
    let cw = pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1;
    return cw;
  }

  let cw = check_concavity(amin[0]?poly1:poly0, amin[1]);
  let ret = trace_outline(...amin, -1, cw, true);
  if (!ret) {
    return [];
  }
  return ret;
}

function seg_isect_poly(x0,y0,x1,y1,poly,is_ray=false){
  let n = poly.length;
  let isects = [];
  for (let i = 0; i < poly.length; i++){
    let a = poly[i];
    let b = poly[(i+1)%n];
    let xx = seg_isect(x0,y0,x1,y1,...a,...b,is_ray);
    if (xx){
      isects.push(xx);
    }
  }
  isects.sort((a,b)=>a.t-b.t);
  return isects;
}

function clip(polyline,polygon){
  if (!polyline.length){
    return {true:[],false:[]};
  }
  let zero = seg_isect_poly(...polyline[0],polyline[0][0]+Math.E,polyline[0][1]+PI,polygon,true).length % 2 != 0;
  let out = {
    'true' :[[]],
    'false':[[]],
  }
  let io = zero;
  for (let i = 0; i < polyline.length; i++){
    let a= polyline[i];
    let b= polyline[i+1];
    out[io][out[io].length-1].push(a);
    if (!b) break;

    let isects = seg_isect_poly(...a,...b,polygon,false);
    for (let j = 0; j < isects.length; j++){
      out[io][out[io].length-1].push(isects[j].xy);
      io = !io;
      out[io].push([isects[j].xy]);
    }
  }
  out.true = out.true.filter(x=>x.length);
  out.false = out.false.filter(x=>x.length);
  return out;
}

function clip_multi(polylines,polygon,clipper_func=clip){
  let out = {
    true:[],
    false:[],
  };
  for (let i = 0; i < polylines.length; i++){
    let c = clipper_func(polylines[i],polygon);
    out.true.push(...c.true);
    out.false.push(...c.false); 
  }
  return out;
}

function binclip(polyline,func){
  if (!polyline.length){
    return {true:[],false:[]};
  }
  let bins = [];
  for (let i = 0; i < polyline.length; i++){
    let t = i/(polyline.length-1);
    bins.push(func(...polyline[i],t));
  }
  let zero = bins[0];
  let out = {
    'true' :[[]],
    'false':[[]],
  }
  let io = zero;
  for (let i = 0; i < polyline.length; i++){
    let a= polyline[i];
    let b= polyline[i+1];
    out[io][out[io].length-1].push(a);
    if (!b) break;

    let do_isect = bins[i] != bins[i+1];

    if (do_isect){
      let pt = lerp2d(...a,...b,0.5);
      out[io][out[io].length-1].push(pt);
      io = !io;
      out[io].push([pt]);
    }
  }
  out.true = out.true.filter(x=>x.length);
  out.false = out.false.filter(x=>x.length);
  return out;
}

function shade_shape(poly,step=5,dx=10,dy=20){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = -bbox.h; i < bbox.w; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i + bbox.h;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;

  let carve = trsl_poly(poly,-dx,-dy);

  lines = clip_multi(lines,carve).false;

  for (let i = 0; i < lines.length; i++){
    let [a,b] = lines[i];
    let s = rand()*0.5;
    if (dy > 0){
      a = lerp2d(...a,...b,s);
      lines[i][0] = a;
    }else{
      b = lerp2d(...b,...a,s);
      lines[i][1] = b;
    }
  }

  return lines;
}

function fill_shape(poly,step=5){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = 0; i < bbox.w+bbox.h/2; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i - bbox.h/2;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;
  return lines;
}

function patternshade_shape(poly,step=5,pattern_func){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = -bbox.h/2; i < bbox.w; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i + bbox.h/2;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;

  for (let i = 0; i < lines.length; i++){
    lines[i] = resample(lines[i],2);
  }

  lines = clip_multi(lines,pattern_func,binclip).true;

  return lines;
}

function vein_shape(poly,n=50){
  let bbox = get_bbox(poly);
  let out = [];
  for (let i = 0; i < n; i++){
    let x = bbox.x + rand()*bbox.w;
    let y = bbox.y + rand()*bbox.h;
    let o = [[x,y]];
    for (let j = 0; j < 15; j++){
      let dx = (noise(x*0.1,y*0.1,7)-0.5)*4;
      let dy = (noise(x*0.1,y*0.1,6)-0.5)*4;
      x += dx;
      y += dy;
      o.push([x,y]);
    }
    out.push(o);
  }
  out = clip_multi(out,poly).true;
  return out;
}

function isect_circ_line(cx,cy,r,x0,y0,x1,y1){
  //https://stackoverflow.com/a/1084899
  let dx = x1-x0;
  let dy = y1-y0;
  let fx = x0-cx;
  let fy = y0-cy;
  let a = dx*dx+dy*dy;
  let b = 2*(fx*dx+fy*dy);
  let c = (fx*fx+fy*fy)-r*r;
  let discriminant = b*b-4*a*c;
  if (discriminant<0){
    return null;
  }
  discriminant = Math.sqrt(discriminant);
  let t0 = (-b - discriminant)/(2*a);
  if (0 <= t0 && t0 <= 1){
    return t0;
  }
  let t = (-b + discriminant)/(2*a);
  if (t > 1 || t < 0){
    return null;
  }
  return t;
}

function resample(polyline,step){
  if (polyline.length < 2){
    return polyline.slice();
  }
  polyline = polyline.slice();
  let out = [polyline[0].slice()];
  let next = null;
  let i = 0;
  while(i < polyline.length-1){
    let a = polyline[i];
    let b = polyline[i+1];
    let dx = b[0]-a[0];
    let dy = b[1]-a[1];
    let d = Math.sqrt(dx*dx+dy*dy);
    if (d == 0){
      i++;
      continue;
    }
    let n = ~~(d/step);
    let rest = (n*step)/d;
    let rpx = a[0] * (1-rest) + b[0] * rest;
    let rpy = a[1] * (1-rest) + b[1] * rest;
    for (let j = 1; j <= n; j++){
      let t = j/n;
      let x = a[0]*(1-t) + rpx*t;
      let y = a[1]*(1-t) + rpy*t;
      let xy = [x,y];
      for (let k = 2; k < a.length; k++){
        xy.push(a[k]*(1-t) + (a[k] * (1-rest) + b[k] * rest)*t);
      }
      out.push(xy);
    }

    next = null;
    for (let j = i+2; j < polyline.length; j++){
      let b = polyline[j-1];
      let c = polyline[j];
      if (b[0] == c[0] && b[1] == c[1]){
        continue;
      }
      let t = isect_circ_line(rpx,rpy,step,b[0],b[1],c[0],c[1]);
      if (t == null){
        continue;
      }
 
      let q = [
        b[0]*(1-t)+c[0]*t,
        b[1]*(1-t)+c[1]*t,
      ];
      for (let k = 2; k < b.length; k++){
        q.push(b[k]*(1-t)+c[k]*t);
      }
      out.push(q);
      polyline[j-1] = q;
      next = j-1;
      break;
    }
    if (next == null){
      break;
    }
    i = next;

  }

  if (out.length > 1){
    let lx = out[out.length-1][0];
    let ly = out[out.length-1][1];
    let mx = polyline[polyline.length-1][0];
    let my = polyline[polyline.length-1][1];
    let d = Math.sqrt((mx-lx)**2+(my-ly)**2);
    if (d < step*0.5){
      out.pop(); 
    }
  }
  out.push(polyline[polyline.length-1].slice());
  return out;
}

function pt_seg_dist(p, p0, p1)  {
  // https://stackoverflow.com/a/6853926
  let x = p[0];   let y = p[1];
  let x1 = p0[0]; let y1 = p0[1];
  let x2 = p1[0]; let y2 = p1[1];
  let A = x - x1; let B = y - y1; let C = x2 - x1; let D = y2 - y1;
  let dot = A*C+B*D;
  let len_sq = C*C+D*D;
  let param = -1;
  if (len_sq != 0) {
    param = dot / len_sq;
  }
  let xx; let yy;
  if (param < 0) {
    xx = x1; yy = y1;
  }else if (param > 1) {
    xx = x2; yy = y2;
  }else {
    xx = x1 + param*C;
    yy = y1 + param*D;
  }
  let dx = x - xx;
  let dy = y - yy;
  return Math.sqrt(dx*dx+dy*dy);
}

function approx_poly_dp(polyline, epsilon){
  if (polyline.length <= 2){
    return polyline;
  }
  let dmax   = 0;
  let argmax = -1;
  for (let i = 1; i < polyline.length-1; i++){
    let d = pt_seg_dist(polyline[i] , 
                        polyline[0] , 
                        polyline[polyline.length-1] );
    if (d > dmax){
      dmax = d;
      argmax = i;
    }  
  }
  let ret = [];
  if (dmax > epsilon){
    let L = approx_poly_dp(polyline.slice(0,argmax+1),epsilon);
    let R = approx_poly_dp(polyline.slice(argmax,polyline.length),epsilon);
    ret = ret.concat(L.slice(0,L.length-1)).concat(R);
  }else{
    ret.push(polyline[0].slice());
    ret.push(polyline[polyline.length-1].slice());
  }
  return ret;
}

function distsq(x0, y0, x1, y1) {
  let dx = x0-x1;
  let dy = y0-y1;
  return dx*dx+dy*dy;
}

function poissondisk(W, H, r, samples) {
  let grid = [];
  let active = [];
  let w =  ((r) / (1.4142135624));
  let r2 = ((r) * (r));
  let cols = (~~(((W) / (w))));
  let rows = (~~(((H) / (w))));
  for (let i = (0); Number((i) < (((cols) * (rows)))); i += (1)) {
    (grid).splice((grid.length), 0, (-1));
  };
  let pos = [(((W) / (2.0))), (((H) / (2.0)))];
  (samples).splice((samples.length), 0, (pos));
  for (let i = (0); Number((i) < (samples.length)); i += (1)) {
    let col = (~~(((((((samples)[i]))[0])) / (w))));
    let row = (~~(((((((samples)[i]))[1])) / (w))));
    ((grid)[((col) + (((row) * (cols))))] = i);
    (active).splice((active.length), 0, (((samples)[i])));
  };
  while (active.length) {
    let ridx = (~~(((rand()) * (active.length))));
    pos = ((active)[ridx]);
    let found = 0;
    for (let n = (0); Number((n) < (30)); n += (1)) {
      let sr = ((r) + (((rand()) * (r))));
      let sa = ((6.2831853072) * (rand()));
      let sx = ((((pos)[0])) + (((sr) * (Math.cos(sa)))));
      let sy = ((((pos)[1])) + (((sr) * (Math.sin(sa)))));
      let col = (~~(((sx) / (w))));
      let row = (~~(((sy) / (w))));
      if (((((((((Number((col) > (0))) && (Number((row) > (0))))) && (Number((col) < (((cols) - (1))))))) && (Number((row) < (((rows) - (1))))))) && (Number((((grid)[((col) + (((row) * (cols))))])) == (-1))))) {
        let ok = 1;
        for (let i = (-1); Number((i) <= (1)); i += (1)) {
          for (let j = (-1); Number((j) <= (1)); j += (1)) {
            let idx = ((((((((row) + (i))) * (cols))) + (col))) + (j));
            let nbr = ((grid)[idx]);
            if (Number((-1) != (nbr))) {
              let d = distsq(sx, sy, ((((samples)[nbr]))[0]), ((((samples)[nbr]))[1]));
              if (Number((d) < (r2))) {
                ok = 0;
              };
            };
          };
        };
        if (ok) {
          found = 1;
          ((grid)[((((row) * (cols))) + (col))] = samples.length);
          let sample = [(sx), (sy)];
          (active).splice((active.length), 0, (sample));
          (samples).splice((samples.length), 0, (sample));
        };
      };
    };
    if (Number(!(found))) {
      (active).splice((ridx), (1));
    };
  };
}

function draw_svg(polylines){
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="320">`
  o += `<rect x="0" y="0" width="520" height="320" fill="floralwhite"/><rect x="10" y="10" width="500" height="300" stroke="black" stroke-width="1" fill="none"/><path stroke="black" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" d="`
  for (let i = 0; i < polylines.length; i++){
    o += '\nM ';
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      o += `${(~~((x+10)*100)) /100} ${(~~((y+10)*100)) /100} `;
    }
  }
  o += `\n"/></svg>`
  return o;
}

function draw_svg_anim(polylines,speed){
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="320">`;
  o += `<rect x="0" y="0" width="520" height="320" fill="floralwhite"/><rect x="10" y="10" width="500" height="300" stroke="black" stroke-width="1" fill="none"/>`
  let lengths = [];
  let acc_lengths = [];
  let total_l = 0;
  for (let i = 0; i < polylines.length; i++){
    let l = 0;
    for (let j = 1; j < polylines[i].length; j++){
      l += Math.hypot(
        polylines[i][j-1][0]-polylines[i][j][0],
        polylines[i][j-1][1]-polylines[i][j][1]
      );
    }
    lengths.push(l);
    acc_lengths.push(total_l);
    total_l+=l;
  }
  for (let i = 0; i < polylines.length; i++){
    let l = lengths[i];
    o += `
    <path 
      stroke="black" 
      stroke-width="1" 
      fill="none" 
      stroke-dasharray="${l}"
      stroke-dashoffset="${l}"
      d="M`;
    for (let j = 0; j < polylines[i].length; j++){
      o += polylines[i][j] + ' ';
    }
    let t = speed*l;
    o += `">
    <animate id="a${i}"
      attributeName="stroke-dashoffset" 
      fill="freeze"
      from="${l}" to="${0}" dur="${t}s" 
      begin="${(acc_lengths[i])*speed}s;a${i}.end+${8+speed*total_l-t}s"/>
    />
    <animate id="b${i}"
      attributeName="stroke-dashoffset" 
      fill="freeze"
      from="${0}" to="${l}" dur="${3}s" 
      begin="${5+speed*total_l}s;b${i}.end+${5+speed*total_l}s"/>
    />
    </path>`;
  }
  o += `</svg>`;
  return o;
}

function draw_ps(polylines){
  let o = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 520 320
1 setlinewidth
0.5 0.5 translate
/m /moveto load def
/l /lineto load def
/F /stroke load def
%%EndPageSetup
10 10 m
510 10 l
510 310 l
10 310 l
closepath
F
`;
  for (let i = 0; i < polylines.length; i++){
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      o += `${(~~((x+10)*100)) /100} ${(~~((310-y)*100)) /100} `;
      if (j == 0) {
        o += `m\n`;
      } else {
        o += `l\n`;
      }
    }
    o += `F\n\n`;
  }
  return o;
}

function pow(a,b){
  return Math.sign(a) * Math.pow(Math.abs(a),b);
}

function trsl_poly(poly,x,y){
  return poly.map(xy=>[xy[0]+x,xy[1]+y]);
}

function scl_poly(poly,sx,sy){
  if (sy === undefined) sy = sx;
  return poly.map(xy=>[xy[0]*sx,xy[1]*sy]);
}

function shr_poly(poly,sx){
  return poly.map(xy=>[xy[0]+xy[1]*sx,xy[1]]);
}

function rot_poly(poly,th){
  let qoly = [];
  let costh = Math.cos(th);
  let sinth = Math.sin(th);
  for (let i = 0; i < poly.length; i++){
    let [x0,y0] = poly[i]
    let x = x0* costh-y0*sinth;
    let y = x0* sinth+y0*costh;
    qoly.push([x,y]);
  }
  return qoly;
}

function rot_around(poly,th,cx,cy){
  return trsl_poly(rot_poly(trsl_poly(poly,-cx,-cy),th),cx,cy);
}

function bbox_overlap(a,b){
  return !(a.x > b.x+b.w || a.x+a.w < b.x || a.y > b.y+b.h || a.y+a.h < b.y);
}

// remove the parts of polylines that fall inside any of the polygons

// remove the parts of polylines that fall inside any of the polygons
function clip_out(polylines,polys){
  for (let k = 0; k < polys.length; k++){
    let poly = polys[k];
    if (!poly || poly.length < 3){
      continue;
    }
    let pb = get_bbox(poly);
    let out = [];
    for (let i = 0; i < polylines.length; i++){
      if (polylines[i].length < 2){
        continue;
      }
      if (bbox_overlap(get_bbox(polylines[i]),pb)){
        out.push(...clip(polylines[i],poly).false);
      }else{
        out.push(polylines[i]);
      }
    }
    polylines = out;
  }
  return polylines;
}

// layers are ordered front to back; each layer is hidden behind the outlines of the layers before it

// layers are ordered front to back; each layer is hidden behind the outlines of the layers before it
function compose(layers){
  let occ = [];
  let out = [];
  for (let i = 0; i < layers.length; i++){
    out.push(...clip_out(layers[i].lines,occ));
    occ.push(...layers[i].occ);
  }
  return out;
}

// closed Catmull-Rom spline through the points, seg samples per span

// closed Catmull-Rom spline through the points, seg samples per span
function catmull_closed(pts,seg){
  let n = pts.length;
  let o = [];
  for (let i = 0; i < n; i++){
    let p0 = pts[(i-1+n)%n];
    let p1 = pts[i];
    let p2 = pts[(i+1)%n];
    let p3 = pts[(i+2)%n];
    for (let j = 0; j < seg; j++){
      let t = j/seg;
      let t2 = t*t;
      let t3 = t2*t;
      o.push([0,1].map(k=>0.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3)));
    }
  }
  return o;
}

function bezier3(p0,p1,p2,p3,n=20){
  let o = [];
  for (let i = 0; i < n; i++){
    let t = i/(n-1);
    let s = 1-t;
    o.push([
      s*s*s*p0[0]+3*s*s*t*p1[0]+3*s*t*t*p2[0]+t*t*t*p3[0],
      s*s*s*p0[1]+3*s*s*t*p1[1]+3*s*t*t*p2[1]+t*t*t*p3[1],
    ]);
  }
  return o;
}

function ellipse(cx,cy,rx,ry,th=0,n=24){
  let o = [];
  for (let i = 0; i <= n; i++){
    let a = i/n*PI*2;
    let x = Math.cos(a)*rx;
    let y = Math.sin(a)*ry;
    o.push([
      cx + x*Math.cos(th) - y*Math.sin(th),
      cy + x*Math.sin(th) + y*Math.cos(th),
    ]);
  }
  return o;
}

function interp_y(curve,x){
  for (let i = 0; i < curve.length-1; i++){
    let [x0,y0] = curve[i];
    let [x1,y1] = curve[i+1];
    if ((x0 <= x && x <= x1) || (x1 <= x && x <= x0)){
      return x1 == x0 ? y0 : lerp(y0,y1,(x-x0)/(x1-x0));
    }
  }
  return null;
}

// two offset edges along a path, half width given by wfunc(t)

// two offset edges along a path, half width given by wfunc(t)
function tube(path,wfunc){
  let l = [];
  let r = [];
  for (let i = 0; i < path.length; i++){
    let a = path[Math.max(0,i-1)];
    let b = path[Math.min(path.length-1,i+1)];
    let ang = Math.atan2(b[1]-a[1],b[0]-a[0]);
    let w = wfunc(i/(path.length-1));
    l.push([path[i][0]+Math.cos(ang-PI/2)*w, path[i][1]+Math.sin(ang-PI/2)*w]);
    r.push([path[i][0]+Math.cos(ang+PI/2)*w, path[i][1]+Math.sin(ang+PI/2)*w]);
  }
  return [l,r];
}


// a single feather: shaft from (x0,y0) along ang, narrow leading vane, wide trailing vane

function pt_in_poly(x,y,poly){
  return seg_isect_poly(x,y,x+Math.E,y+PI,poly,true).length % 2 == 1;
}

// a contour made of overlapping feather tips: small arcs bulging out of the shape, with gaps

// ---------------------------------------------------------------- ships

// the ship floats on this line; it faces left, bow at small x
const YW = 200;

// the hull in profile: a sheer line (the deck edge) that rises toward bow and stern,
// a bow and a stern profile, and a keel well below the water
function hull_shape(arg){
  let L = arg.hull_length;
  let F = arg.freeboard;
  let D = F*1.4;
  let xb = -arg.bow_rake*F;
  let xs = L+arg.stern_overhang*F;
  let ysh = t=>{
    t = Math.max(0,Math.min(1,t));
    let e = arg.sheer_pow || 2.2;
    return YW-F-F*arg.sheer*(arg.bow_rise*Math.pow(1-t,e)+arg.stern_rise*Math.pow(t,e));
  };
  let deck = t=>[lerp(xb,xs,t),ysh(t)];
  let n = 64;
  let sheer = [];
  for (let i = 0; i < n; i++){
    sheer.push(deck(i/(n-1)));
  }
  let [bx,by] = sheer[0];
  let [sx,sy] = sheer[n-1];
  let bow = bezier3([bx,by],[lerp(bx,0,0.4)-arg.bow_curve*F,lerp(by,YW,0.75)],[-L*0.01,YW+D*0.5],[L*0.12,YW+D],20);
  let stern;
  if (arg.transom){
    stern = bezier3([sx,sy],[lerp(sx,L,0.4),lerp(sy,YW,0.4)],[L+L*0.005,YW+D*0.3],[L*0.88,YW+D],20);
  }else{
    stern = bezier3([sx,sy],[sx+F*0.08,lerp(sy,YW,0.8)],[L+L*0.03,YW+D*0.2],[L*0.88,YW+D],20);
  }
  let outline = sheer.concat(stern.slice(1),bow.slice().reverse().slice(0,-1));
  return {L,F,D,xb,xs,ysh,deck,sheer,bow,stern,outline,tx:x=>(x-xb)/(xs-xb)};
}

// lines running the length of the hull, following the sheer: planks, wales, and the engraved
// tone of the hull. Tone comes from the spacing; dark(k) at depth k (0 at the deck edge, 1 at
// the keel) is 1 where lines run, 0 for a light band and in between for broken lines
function hull_lines(h,spacing,dark,z){
  let lines = [];
  for (let k = spacing/(h.F*2.4); k < 1; k += spacing/(h.F*2.4)){
    let line = [];
    for (let t = -0.15; t <= 1.15; t += 0.01){
      let x = lerp(h.xb,h.xs,t);
      let y = lerp(h.ysh(t),YW+h.D,k);
      line.push([x,y]);
    }
    line = resample(line,1.5);
    let kk = k;
    lines.push(...binclip(line,(x,y)=>(noise(x*0.03,y*0.08,z)*0.12+0.44 < dark(kk))).true);
  }
  return clip_multi(lines,h.outline).true;
}

// the depth fraction of a point under the deck edge, as used by hull_lines
function hull_depth(h,x,y){
  let t = h.tx(x);
  return (y-h.ysh(t))/(YW+h.D-h.ysh(t));
}

// a row of small square ports below the deck edge, filled dark
function gunports(h,k,size,t0,t1,step){
  let lines = [];
  let occ = [];
  for (let t = t0; t <= t1; t += step){
    let x = lerp(h.xb,h.xs,t);
    let y = lerp(h.ysh(t),YW+h.D,k);
    let p = [[x-size/2,y-size/2],[x+size/2,y-size/2],[x+size/2,y+size/2],[x-size/2,y+size/2]];
    lines.push(p.concat([p[0]]),...fill_shape(p,0.8));
    occ.push(p);
  }
  return {lines,occ};
}

function portholes(h,k,r,t0,t1,step){
  let lines = [];
  let occ = [];
  for (let t = t0; t <= t1; t += step){
    let x = lerp(h.xb,h.xs,t);
    let y = lerp(h.ysh(t),YW+h.D,k);
    let c = ellipse(x,y,r,r,0,14);
    lines.push(c);
    occ.push(c);
  }
  return {lines,occ};
}

// stern windows: a small grid just under the deck edge at the stern
function stern_windows(h,rows,cols){
  let lines = [];
  let occ = [];
  let w = h.F*0.11;
  for (let i = 0; i < cols; i++){
    let t = 0.97-i*0.035;
    for (let j = 0; j < rows; j++){
      let x = lerp(h.xb,h.xs,t);
      let y = h.ysh(t)+h.F*(0.16+j*0.2);
      let p = [[x-w/2,y-w*0.7],[x+w/2,y-w*0.7],[x+w/2,y+w*0.7],[x-w/2,y+w*0.7]];
      lines.push(p.concat([p[0]]),[[x,y-w*0.7],[x,y+w*0.7]]);
      occ.push(p);
    }
  }
  return {lines,occ};
}

// a rail above the deck edge, with stanchions
function deck_rail(h,t0,t1,height){
  let top = [];
  let lines = [];
  for (let t = t0; t <= t1+1e-6; t += 0.005){
    let [x,y] = h.deck(t);
    top.push([x,y-height]);
  }
  lines.push(top);
  for (let t = t0; t <= t1+1e-6; t += 0.018){
    let [x,y] = h.deck(t);
    lines.push([[x,y],[x,y-height]]);
  }
  return lines;
}


// a mast: a tapering pole from base, raked aft by rake radians
function make_mast(base,height,rake,w0){
  let dir = [Math.sin(rake),-Math.cos(rake)];
  let aft = [Math.cos(rake),Math.sin(rake)];
  let at = u=>[base[0]+dir[0]*height*u,base[1]+dir[1]*height*u];
  let path = resample([at(-0.05),at(1)],2);
  let [l,r] = tube(path,u=>w0*(1-0.6*u));
  let poly = l.concat(r.slice().reverse());
  return {at,dir,aft,base,height,w0,head:at(1),lines:[l,r,[l[l.length-1],r[r.length-1]]],poly};
}

// a sail as a bulging quadrilateral: head TL-TR, foot BL-BR, luff TL-BL, leech TR-BR.
// A triangle has TL == TR. The sides belly out by bulge, the foot by belly; seams run head
// to foot, shading gathers on the leech side, reef bands cross under the head
function make_sail(TL,TR,BL,BR,o){
  let bl = o.bulgeL || 0;
  let br = o.bulgeR || 0;
  let belly = o.belly || 0;
  let P = (f,g)=>{
    let top = lerp2d(...TL,...TR,f);
    let bot = lerp2d(...BL,...BR,f);
    let p = lerp2d(...top,...bot,g);
    let side = f < 0.5 ? -(1-2*f)*bl : (2*f-1)*br;
    return [p[0]+side*Math.sin(PI*g),p[1]+belly*g*Math.sin(PI*f)];
  };
  let n = 20;
  let outline = [];
  for (let i = 0; i <= n; i++) outline.push(P(0,i/n));
  for (let i = 1; i <= n; i++) outline.push(P(i/n,1));
  for (let i = n-1; i >= 0; i--) outline.push(P(1,i/n));
  for (let i = n-1; i >= 1; i--) outline.push(P(i/n,0));
  let lines = [outline.concat([outline[0]])];
  let width = Math.max(dist(...TL,...TR),dist(...BL,...BR));
  // seams: head to foot on a four-sided sail; on a triangle they would all meet at the head,
  // so there the cloths run across, from luff to leech
  if (dist(...TL,...TR) > 1e-6){
    let ns = Math.max(2,Math.round(width/(o.seam || 7)));
    for (let i = 1; i < ns; i++){
      let f = i/ns;
      let seam = [];
      for (let j = 0; j <= n; j++) seam.push(P(f,j/n));
      lines.push(...binclip(resample(seam,1.5),(x,y)=>(noise(x*0.08,y*0.08,31) > 0.3)).true);
    }
  }else{
    let height = Math.max(dist(...TL,...BL),dist(...TR,...BR));
    let ns = Math.max(2,Math.round(height/(o.seam || 7)));
    for (let i = 1; i < ns; i++){
      let g = i/ns;
      let seam = [];
      for (let j = 0; j <= n; j++) seam.push(P(j/n,g));
      lines.push(seam);
    }
  }
  // painted stripes: every other panel hatched dark
  if (o.stripes){
    for (let i = 0; i < o.stripes; i += 2){
      let panel = [];
      for (let j = 0; j <= n; j++) panel.push(P(i/o.stripes,j/n));
      for (let j = n; j >= 0; j--) panel.push(P((i+1)/o.stripes,j/n));
      lines.push(...fill_shape(panel,1.4));
    }
  }
  // shading on the leech side: engraved lines from the foot up, longer toward the leech
  let sh = o.shade === undefined ? 0.5 : o.shade;
  let nh = Math.round(width/2.2);
  let band = sh*0.5;
  for (let i = 0; i < nh; i++){
    let f = (i+0.5)/nh;
    if (f < 1-band) continue;
    let depth = (f-(1-band))/band;
    let g0 = Math.max(0.02,1-depth*(0.6+noise(f*7,33)*0.5));
    let line = [];
    for (let j = 0; j <= n; j++){
      let g = lerp(g0,0.98,j/n);
      line.push(P(f,g));
    }
    lines.push(line);
  }
  // reef bands
  for (let k = 0; k < (o.reefs || 0); k++){
    let g = 0.1+k*0.09;
    let band = [];
    for (let i = 0; i <= n; i++) band.push(P(i/n,g));
    lines.push(band);
    for (let i = 1; i < n; i += 2){
      let p = P(i/n,g);
      lines.push([p,[p[0],p[1]+2]]);
    }
  }
  return {lines,occ:[outline]};
}

// a sail furled on its yard: a fat roll with lashings
function furled(a,b){
  let path = resample([a,b],1.5);
  let [l,r] = tube(path,u=>1.8*Math.pow(Math.sin(PI*Math.min(0.98,Math.max(0.02,u))),0.3));
  let lines = [l,r];
  for (let i = 3; i < path.length-3; i += 4) lines.push([l[i],r[i]]);
  return {lines,occ:[l.concat(r.slice().reverse())]};
}

// a spar (yard, boom, gaff, bowsprit) between two points
function spar(a,b,w){
  let path = resample([a,b],2);
  let [l,r] = tube(path,u=>w*(1-0.4*Math.abs(u-0.5)*2));
  return {lines:[l,r,[l[0],r[0]],[l[l.length-1],r[r.length-1]]],occ:[l.concat(r.slice().reverse())]};
}

// shrouds from points high on the mast down to the deck edge, with ratlines across them
function shrouds(h,m,u,n,spread){
  let lines = [];
  let top = m.at(u);
  let feet = [];
  for (let i = 0; i < n; i++){
    let x = m.base[0]+lerp(-spread*0.2,spread,i/(n-1));
    feet.push([x,h.ysh(h.tx(x))]);
  }
  for (let f of feet) lines.push([top,f]);
  let y0 = top[1]+4;
  let y1 = Math.max(...feet.map(f=>f[1]))-3;
  let xat = (f,y)=>lerp(top[0],f[0],(y-top[1])/(f[1]-top[1]));
  for (let y = y0; y < y1; y += 3){
    lines.push([[xat(feet[0],y),y],[xat(feet[n-1],y),y]]);
  }
  return lines;
}

// a flag streaming aft from p: a waving strip, hatched in stripes
function flag(p,len,wid,tri,z){
  let n = 24;
  let top = [];
  let bot = [];
  for (let i = 0; i <= n; i++){
    let u = i/n;
    let x = p[0]+len*u;
    let wave = Math.sin(u*PI*2.2+z)*wid*0.25*u;
    let w = wid*(tri ? 1-u*0.9 : 1);
    top.push([x,p[1]+wave]);
    bot.push([x,p[1]+wave+w]);
  }
  let poly = top.concat(bot.slice().reverse());
  let lines = [poly.concat([poly[0]])];
  if (!tri){
    for (let k = 1; k < 4; k += 2){
      let a = [];
      let b = [];
      for (let i = 0; i <= n; i++){
        a.push(lerp2d(...top[i],...bot[i],k/4));
        b.push(lerp2d(...top[i],...bot[i],(k+1)/4));
      }
      let stripe = a.concat(b.slice().reverse());
      lines.push(...fill_shape(stripe,1));
    }
  }
  let outline = lines.shift();
  return {lines:clip_multi(lines,outline).true.concat([outline]),occ:[poly]};
}

// a spiral post (the stem and stern of a longship): a tapering tube that curls inward
function curl_post(p,a0,len,turn,w){
  let n = 70;
  let path = [p];
  let [x,y] = p;
  for (let i = 1; i < n; i++){
    let u = i/(n-1);
    let a = a0+turn*Math.pow(u,2.4);
    x += Math.cos(a)*len/(n-1)*(1-0.55*u);
    y += Math.sin(a)*len/(n-1)*(1-0.55*u);
    path.push([x,y]);
  }
  let [l,r] = tube(path,u=>w*(1-0.75*u));
  let poly = l.concat(r.slice().reverse());
  return {lines:[l,r,[l[l.length-1],r[r.length-1]]],occ:[poly],path};
}

// a round shield with a boss and a painted pattern
function shield(c,r,k){
  let o = ellipse(...c,r,r,0,24);
  let boss = ellipse(...c,r*0.24,r*0.24,0,12);
  let lines = [o,boss];
  if (k % 3 == 0){
    for (let a = 0; a < 4; a++){
      let ang = a*PI/2+PI/4;
      lines.push([[c[0]+Math.cos(ang)*r*0.24,c[1]+Math.sin(ang)*r*0.24],[c[0]+Math.cos(ang)*r,c[1]+Math.sin(ang)*r]]);
    }
  }else if (k % 3 == 1){
    let half = [c];
    for (let i = 0; i <= 12; i++){
      let a = PI*0.5+i/12*PI;
      half.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]);
    }
    lines.push(...clip_multi(fill_shape(half,1.1),boss).false);
  }else{
    lines.push(...clip_multi(fill_shape(o,2.2),boss).false);
  }
  return {lines,occ:[o]};
}

// a ship's boat in profile
function boat(x,y,len,ht){
  let top = [];
  let bot = [];
  for (let i = 0; i <= 16; i++){
    let u = i/16;
    top.push([x+len*u,y-ht*0.15*Math.pow(2*u-1,2)]);
    bot.push([x+len*u,y+ht*(1-Math.pow(2*u-1,4))]);
  }
  let poly = top.concat(bot.slice().reverse());
  let lines = [poly.concat([poly[0]]),top.map(p=>[p[0],p[1]+ht*0.3])];
  return {lines,occ:[poly]};
}

// a funnel: raked aft, a dark band at the top, shading down its after side
function funnel(base,w,ht,rake,bands){
  let dir = [Math.sin(rake),-Math.cos(rake)];
  let aft = [Math.cos(rake),Math.sin(rake)];
  let at = (f,u)=>[base[0]+aft[0]*w*(f-0.5)+dir[0]*ht*u,base[1]+aft[1]*w*(f-0.5)+dir[1]*ht*u];
  let poly = [at(0,-0.1),at(1,-0.1),at(1,1),at(0.5,1.02),at(0,1)];
  let lines = [poly.concat([poly[0]])];
  let top = [at(0,1),at(0,0.82),at(1,0.82),at(1,1)];
  lines.push(...fill_shape(top,1));
  lines.push([at(0,0.82),at(1,0.82)]);
  if (bands){
    let b = [at(0,0.7),at(0,0.66),at(1,0.66),at(1,0.7)];
    lines.push(...fill_shape(b,1),[at(0,0.7),at(1,0.7)],[at(0,0.66),at(1,0.66)]);
  }
  for (let f = 0.72; f < 1; f += 0.07){
    lines.push([at(f,0),at(f,0.8)]);
  }
  let outline = lines.shift();
  return {lines:clip_multi(lines,outline).true.concat([outline]),occ:[poly],top:at(0.5,1.02)};
}

// smoke drifting aft and up from p: a chain of growing puffs, the nearest in front
function smoke(p,r0,n,z){
  let lines = [];
  let occ = [];
  let [x,y] = p;
  let r = r0;
  for (let k = 0; k < n; k++){
    x += r*1.25;
    y -= r*0.45+(noise(k*0.3,z)-0.5)*r*0.8;
    r *= 1.13;
    let c = [];
    for (let i = 0; i <= 30; i++){
      let a = i/30*PI*2;
      let rr = r*(1+(noise(Math.cos(a)+k,Math.sin(a)+z,33)-0.5)*0.5);
      c.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);
    }
    let edge = binclip(resample(c,1.5),(px,py)=>(noise(px*0.06,py*0.06,z+k) > 0.3)).true;
    let tone = clip_multi(shade_shape(c,3.4,r*0.6,r*0.6),c).true;
    lines.push(...clip_out(edge.concat(tone),occ));
    occ.push(c);
  }
  return {lines,occ};
}

// the sea: a surface that swells a little, engraved lines below it opening toward the viewer,
// the bow wave and the wake. Everything under the surface is hidden
function sea(h,xa,xb,arg){
  let F = h.F;
  let surf = x=>YW+(noise(x*0.015,arg.sea_z)-0.5)*F*arg.chop+Math.sin(x*0.08+arg.sea_z)*F*arg.chop*0.08;
  let surface = [];
  for (let x = xa; x <= xb; x += 2) surface.push([x,surf(x)]);
  let lines = [surface];
  let gap = 2.2;
  let k = 0;
  for (let d = gap; d < F*2.6; d += gap, gap *= 1.16, k++){
    let line = [];
    for (let x = xa; x <= xb; x += 2) line.push([x,surf(x)+d+(noise(x*0.03,k*2.7,81)-0.5)*2]);
    let kk = k;
    let z = rand()*100;
    lines.push(...binclip(line,(x,y,t)=>{
      // darker below the hull: the ship's reflection
      let under = (x > h.xb && x < h.xs) ? 0.25 : 0;
      return noise(x*0.025,z)*Math.sin(t*PI)+under > 0.38+kk*0.015;
    }).true);
  }
  let occ = [[xa-1e4,surf(xa)]].concat(surface,[[xb+1e4,surf(xb)],[xb+1e4,YW+1e4],[xa-1e4,YW+1e4]]);
  let fronts = [];
  // bow wave: a crest thrown up against the stem, with foam curls
  if (arg.speed > 0){
    let bx = 0;
    let ht = F*0.35*arg.speed;
    let crest = bezier3([bx-F*0.6*arg.speed,surf(bx)],[bx-F*0.1,surf(bx)-ht*1.4],[bx+F*0.4,surf(bx)-ht*0.6],[bx+F*1.6,surf(bx)],16);
    let cpoly = crest.concat([[bx+F*1.6,surf(bx)+2],[bx-F*0.6*arg.speed,surf(bx)+2]]);
    let foam = [];
    for (let i = 0; i < 6; i++){
      let u = 0.2+i*0.12;
      let p = crest[~~(u*(crest.length-1))];
      let c = ellipse(p[0],p[1]+2,1.6,1,0,8).slice(0,6);
      foam.push(c);
    }
    fronts.push({lines:[crest,...foam],occ:[cpoly]});
    // the wake: broken lines spreading back from the stern
    for (let i = 0; i < 4; i++){
      let w = [];
      for (let x = h.xs; x < xb; x += 2){
        let u = (x-h.xs)/(xb-h.xs);
        w.push([x,surf(x)+1.5+i*2.2*(0.3+u)+u*F*0.15]);
      }
      lines.push(...binclip(w,(x,y,t)=>(noise(x*0.05,i*5.3,82)*(1-t) > 0.22)).true);
    }
  }
  return {layer:{lines,occ:[occ]},fronts};
}

// gulls: a couple of shallow m-shapes in the sky
function gulls(xa,xb,ya,yb,n){
  let lines = [];
  for (let i = 0; i < n; i++){
    let x = lerp(xa,xb,rand());
    let y = lerp(ya,yb,rand());
    let s = 3+rand()*3;
    let tilt = (rand()-0.5)*0.5;
    let w = [[-s,0.2*s],[-s*0.5,-0.35*s],[0,0],[s*0.5,-0.35*s],[s,0.2*s]];
    lines.push(trsl_poly(rot_poly(resample(w,0.6),tilt),x,y));
  }
  return lines;
}


// ---------------------------------------------------------------- rigs

// square sails on one mast: courses at the bottom, smaller sails above, some furled
function square_rig(m,arg,tiers,yw0,layers){
  let ys = [];
  for (let j = 0; j < tiers; j++){
    ys.push(tiers == 1 ? 0.78 : lerp(0.36,0.92,j/(tiers-1)));
  }
  let half = j=>yw0*Math.pow(0.8,j);
  let yard = j=>{
    let c = m.at(ys[j]);
    return [[c[0]-m.aft[0]*half(j),c[1]-m.aft[1]*half(j)],[c[0]+m.aft[0]*half(j),c[1]+m.aft[1]*half(j)]];
  };
  for (let j = tiers-1; j >= 0; j--){
    let [a,b] = yard(j);
    let up = m.at(ys[j]+0.04);
    layers.rig.push([a,up],[b,up]);
    layers.spars.push(spar(a,b,1));
    if (rand() < arg.furl*(j/Math.max(1,tiers-1))){
      layers.sails.push(furled(a,b));
      continue;
    }
    let foot_u = j == 0 ? 0.1 : ys[j-1]+0.02;
    let fh = j == 0 ? half(0)*1.05 : half(j-1)*0.98;
    let fc = m.at(foot_u);
    let BL = [fc[0]-m.aft[0]*fh,fc[1]-m.aft[1]*fh];
    let BR = [fc[0]+m.aft[0]*fh,fc[1]+m.aft[1]*fh];
    let hgt = dist(...a,...BL);
    layers.sails.push(make_sail(a,b,BL,BR,{bulgeL:hgt*0.025,bulgeR:hgt*0.025,belly:hgt*0.09,shade:arg.sail_shade,reefs:j < 2 ? arg.reefs : 0}));
  }
  return ys;
}

// a gaff sail aft of the mast, from boom to gaff, with an optional topsail above the gaff
function gaff_rig(m,arg,boom_len,layers,bermuda){
  let tack = m.at(0.08);
  let clew = [tack[0]+boom_len,tack[1]-boom_len*0.06];
  layers.spars.push(spar(tack,clew,1.1));
  if (bermuda){
    let head = m.at(0.96);
    let hgt = dist(...head,...tack);
    layers.sails.push(make_sail(head,head,tack,clew,{bulgeR:hgt*0.05,belly:boom_len*0.06,shade:arg.sail_shade}));
    return;
  }
  let throat = m.at(0.66);
  let ga = arg.gaff_angle;
  let gl = boom_len*0.72;
  let peak = [throat[0]+Math.cos(ga)*gl,throat[1]-Math.sin(ga)*gl];
  layers.spars.push(spar(throat,peak,0.9));
  let hgt = dist(...throat,...tack);
  layers.sails.push(make_sail(throat,peak,tack,clew,{bulgeR:hgt*0.07,belly:boom_len*0.05,shade:arg.sail_shade,reefs:arg.reefs}));
  if (arg.topsail){
    let head = m.at(0.98);
    let hgt2 = dist(...head,...throat);
    layers.sails.push(make_sail(head,head,throat,peak,{bulgeR:hgt2*0.05,belly:-gl*0.04,shade:arg.sail_shade}));
  }
}

// headsails: triangles set on stays from the bowsprit to the foremast
function jibs(fm,bow,tip,n,arg,layers){
  for (let i = n-1; i >= 0; i--){
    let s = n == 1 ? 0.7 : lerp(0.25,1,i/(n-1));
    let tack = lerp2d(...bow,...tip,s);
    let head = fm.at(lerp(0.62,0.95,n == 1 ? 0.5 : i/(n-1)));
    layers.stays.push([tack,fm.at(lerp(0.62,0.95,n == 1 ? 0.5 : i/(n-1))+0.02)]);
    let luff = lerp2d(...tack,...head,0.06);
    let clew = [lerp(tack[0],fm.base[0],0.68),lerp(tack[1],head[1],0.12)];
    let hgt = dist(...head,...tack);
    layers.sails.push(make_sail(head,head,luff,clew,{bulgeR:hgt*0.06,belly:hgt*0.04,shade:arg.sail_shade,seam:6}));
  }
}

// ---------------------------------------------------------------- the ship

const SHIP_TYPES = ['square rigger','fore and aft','steamer','longship'];

function ship(arg){
  let h = hull_shape(arg);
  let L = h.L;
  let F = h.F;
  let layers = {sails:[],spars:[],rig:[],stays:[],masts:[],front:[],flags:[]};
  let hull_occ = [h.outline];
  let hull_extra = [];
  let deco = [];
  let behind = [];

  // ---- hull tone, ports and windows
  let dark;
  let holes = [];
  if (arg.type == 0){
    let rows = arg.warship ? [0.13,0.27] : (arg.ports ? [0.16] : []);
    dark = k=>{
      for (let r of rows) if (Math.abs(k-r) < 0.055) return 0;
      return k < 0.025 ? 0 : 1;
    };
    for (let r of rows) holes.push(gunports(h,r,F*0.13,0.12,0.88,0.05));
    holes.push(stern_windows(h,2,3));
  }else if (arg.type == 1){
    dark = k=>(k < 0.2 ? 0.45 : 1);
    if (arg.ports) holes.push(portholes(h,0.12,F*0.07,0.2,0.75,0.08));
  }else if (arg.type == 2){
    dark = k=>(k < 0.07 ? 0 : 1);
    holes.push(portholes(h,0.15,F*0.055,0.1,0.9,0.022));
    if (arg.decks > 1) holes.push(portholes(h,0.04,F*0.05,0.25,0.78,0.022));
  }else{
    dark = k=>1;
  }
  let planks = hull_lines(h,lerp(4.5,1.7,arg.hull_tone),dark,arg.sea_z+7);
  for (let ho of holes){
    planks = clip_out(planks,ho.occ);
    deco.push(...ho.lines);
  }
  let hull = {lines:[h.sheer,h.stern,h.bow,...planks,...deco],occ:hull_occ};

  // ---- bowsprit
  let bow_top = h.sheer[0];
  let tip = null;
  if (arg.type < 2){
    let a = arg.bowsprit_angle;
    let bl = arg.bowsprit*L;
    tip = [bow_top[0]-Math.cos(a)*bl,bow_top[1]-Math.sin(a)*bl];
    let root = [bow_top[0]+F*0.6,bow_top[1]+F*0.15];
    hull_extra.push(spar(root,tip,1.4));
    // the dolphin striker and its stays under the bowsprit
    let ds = lerp2d(...root,...tip,0.62);
    let dsb = [ds[0],ds[1]+F*0.5];
    layers.rig.push([ds,dsb],[dsb,tip],[dsb,h.bow[~~(h.bow.length*0.45)]]);
  }

  // ---- rig
  if (arg.type == 0){
    let ts = arg.masts == 3 ? [0.2,0.47,0.74] : arg.masts == 2 ? [0.28,0.62] : [0.42];
    let hs = arg.masts == 3 ? [0.93,1,0.8] : arg.masts == 2 ? [0.95,1] : [1];
    let ms = ts.map((t,i)=>make_mast(h.deck(t),arg.rig_height*L*hs[i],arg.rake,F*0.12));
    let spacing = arg.masts > 1 ? (ms[1].base[0]-ms[0].base[0]) : L*0.4;
    for (let i = 0; i < ms.length; i++){
      let m = ms[i];
      let spanker = arg.spanker && i == ms.length-1 && ms.length > 1;
      let tiers = Math.max(1,arg.tiers-(i == ms.length-1 && ms.length == 3 ? 1 : 0));
      let ys;
      if (spanker){
        let boom = h.xs-m.base[0]+F*0.6;
        gaff_rig(m,Object.assign({},arg,{topsail:0,reefs:0}),boom,layers,false);
        ys = square_rig({at:u=>m.at(0.7+u*0.3),aft:m.aft},arg,Math.max(1,tiers-1),spacing*0.45*hs[i]*arg.yard,layers).map(u=>0.7+u*0.3);
      }else{
        ys = square_rig(m,arg,tiers,spacing*0.58*hs[i]*arg.yard,layers);
      }
      layers.rig.push(...shrouds(h,m,ys[0]-0.02,4,F*0.9));
      layers.masts.push({lines:m.lines,occ:[m.poly]});
      for (let u of ys){
        let c = m.at(u-0.03);
        layers.rig.push([[c[0]-F*0.35,c[1]],[c[0]+F*0.35,c[1]]]);
      }
      if (i > 0) layers.stays.push([m.head,ms[i-1].at(0.38)]);
      layers.stays.push([m.head,h.deck(Math.min(0.99,h.tx(m.base[0])+0.18))]);
    }
    layers.stays.push([ms[0].head,tip]);
    jibs(ms[0],lerp2d(...bow_top,...tip,0.15),tip,arg.jibs,arg,layers);
    let main = ms[arg.masts == 1 ? 0 : 1];
    layers.flags.push(flag(main.head,F*arg.pennant,F*0.16,true,arg.sea_z));
  }else if (arg.type == 1){
    let ts = arg.masts == 2 ? [0.3,0.6] : [0.38];
    let hs = arg.masts == 2 ? (arg.ketch ? [1,0.75] : [0.92,1]) : [1];
    let ms = ts.map((t,i)=>make_mast(h.deck(t),arg.rig_height*L*hs[i],arg.rake,F*0.11));
    for (let i = ms.length-1; i >= 0; i--){
      let m = ms[i];
      let boom = i < ms.length-1 ? (ms[i+1].base[0]-m.base[0])*0.9 : (h.xs-m.base[0])*0.95;
      gaff_rig(m,arg,boom,layers,arg.bermuda);
      layers.rig.push(...shrouds(h,m,0.62,3,F*0.5));
      layers.masts.push({lines:m.lines,occ:[m.poly]});
      if (i > 0) layers.stays.push([m.head,ms[i-1].at(0.7)]);
    }
    layers.stays.push([ms[0].head,tip]);
    jibs(ms[0],lerp2d(...bow_top,...tip,0.1),tip,arg.jibs,arg,layers);
    layers.flags.push(flag(ms[ms.length-1].head,F*arg.pennant,F*0.14,true,arg.sea_z));
  }else if (arg.type == 2){
    // superstructure: stacked decks with windows and rails
    let a = arg.super_from;
    let b = arg.super_to;
    let top = Math.min(...[a,b,(a+b)/2].map(t=>h.ysh(t)));
    let tiers = [];
    for (let i = 0; i < arg.decks; i++){
      let ta = a+i*arg.super_step;
      let tb = b-i*arg.super_step*0.6;
      let x0 = lerp(h.xb,h.xs,ta);
      let x1 = lerp(h.xb,h.xs,tb);
      let y1 = i == 0 ? h.ysh((ta+tb)/2)+F*0.4 : tiers[i-1].y0+1;
      let y0 = (i == 0 ? top : tiers[i-1].y0)-F*arg.deck_height;
      let poly = [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
      let lines = [[[x0,y1],[x0,y0],[x1,y0],[x1,y1]]];
      // shadow under the deck above, and a row of windows
      for (let k = 1; k <= 3; k++) lines.push([[x0,y0+k*1.3],[x1,y0+k*1.3]]);
      let ww = F*0.1;
      let wy = lerp(y0,Math.min(y1,y0+F*arg.deck_height),0.55);
      let wins = [];
      for (let x = x0+F*0.3; x < x1-F*0.2; x += F*0.24){
        let p = [[x,wy-ww*0.7],[x+ww,wy-ww*0.7],[x+ww,wy+ww*0.7],[x,wy+ww*0.7]];
        wins.push(p);
        lines.push(p.concat([p[0]]));
      }
      lines = clip_out(lines.slice(1),wins).concat([lines[0]]);
      lines.push(...deck_rail({deck:t=>[lerp(x0,x1,t),y0],},0,1,F*0.12));
      tiers.push({x0,x1,y0,y1,poly,lines});
    }
    for (let i = tiers.length-1; i >= 0; i--) behind.push({lines:tiers[i].lines,occ:[tiers[i].poly]});
    let tt = tiers[tiers.length-1];
    // the bridge at the front of the top deck
    let bw = F*1.3;
    let bridge = [[tt.x0,tt.y0-F*0.7],[tt.x0+bw,tt.y0-F*0.7],[tt.x0+bw,tt.y0+1],[tt.x0,tt.y0+1]];
    let blines = [bridge.concat([bridge[0]])];
    for (let x = tt.x0+F*0.15; x < tt.x0+bw-F*0.15; x += F*0.22){
      blines.push([[x,tt.y0-F*0.55],[x+F*0.12,tt.y0-F*0.55],[x+F*0.12,tt.y0-F*0.35],[x,tt.y0-F*0.35],[x,tt.y0-F*0.55]]);
    }
    behind.unshift({lines:blines,occ:[bridge]});
    // lifeboats in davits along the boat deck
    let bd = tiers[Math.min(1,tiers.length-1)];
    let boats = {lines:[],occ:[]};
    for (let x = bd.x0+F*1.6; x < bd.x1-F*1.4; x += F*1.5){
      let bt = boat(x,bd.y0-F*0.42,F*1.05,F*0.24);
      boats.lines.push(...clip_out(bt.lines,boats.occ));
      boats.occ.push(...bt.occ);
      boats.lines.push(bezier3([x+F*0.1,bd.y0],[x+F*0.1,bd.y0-F*0.7],[x+F*0.3,bd.y0-F*0.7],[x+F*0.3,bd.y0-F*0.5],8));
      boats.lines.push(bezier3([x+F*0.95,bd.y0],[x+F*0.95,bd.y0-F*0.7],[x+F*0.75,bd.y0-F*0.7],[x+F*0.75,bd.y0-F*0.5],8));
    }
    behind.unshift(boats);
    // funnels and their smoke
    let fx0 = tt.x0+bw+F*0.6;
    let fx1 = tt.x1-F*0.6;
    let fs = [];
    for (let i = 0; i < arg.funnels; i++){
      let x = arg.funnels == 1 ? (fx0+fx1)/2 : lerp(fx0,fx1,i/(arg.funnels-1));
      fs.push(funnel([x,tt.y0+F*0.3],F*arg.funnel_w,F*arg.funnel_h,arg.funnel_rake,arg.funnel_band));
    }
    for (let f of fs) behind.push(f);
    if (arg.smoke){
      for (let f of fs) layers.flags.push(smoke(f.top,F*arg.funnel_w*0.45,arg.smoke,arg.sea_z+fs.indexOf(f)));
    }
    // masts with crosstrees, and the stays between them
    let fm = make_mast(h.deck(0.08),F*arg.mast_h,arg.rake,F*0.09);
    let mm = make_mast(h.deck(0.9),F*arg.mast_h*0.95,arg.rake,F*0.09);
    for (let m of [fm,mm]){
      layers.masts.push({lines:m.lines,occ:[m.poly]});
      let c = m.at(0.82);
      layers.rig.push([[c[0]-F*0.3,c[1]],[c[0]+F*0.3,c[1]]]);
    }
    layers.stays.push([bow_top,fm.head],[fm.head,mm.head],[mm.head,h.sheer[h.sheer.length-1]]);
    layers.flags.push(flag(fm.head,F*0.9,F*0.12,true,arg.sea_z));
  }else{
    // longship: curling stem and stern posts, shields along the side, oars, one striped sail
    // the posts carry on the line of the stem and the sternpost, then curl inward
    let tan = (a,b)=>Math.atan2(a[1]-b[1],a[0]-b[0]);
    let bp = curl_post(h.sheer[0],tan(h.bow[0],h.bow[3]),F*arg.post_len,arg.post_curl,F*0.42);
    let sp = curl_post(h.sheer[h.sheer.length-1],tan(h.stern[0],h.stern[3]),F*arg.post_len*0.9,-arg.post_curl,F*0.42);
    hull_extra.push(bp,sp);
    let r = F*0.6;
    let sh = {lines:[],occ:[]};
    let k = 0;
    for (let t = 0.2; t <= 0.8; t += r*1.7/L, k++){
      let [x,y] = h.deck(t);
      let s = shield([x,y+r*0.45],r,k);
      sh.lines.push(...clip_out(s.lines,sh.occ));
      sh.occ.push(...s.occ);
    }
    layers.front.push(sh);
    if (arg.oars){
      let oars = {lines:[],occ:[]};
      for (let t = 0.22; t <= 0.78; t += r*3.4/L){
        let [x,y] = h.deck(t);
        let p = [x+r*0.85,y+r*1.3];
        let q = [p[0]-Math.sin(arg.oar_angle)*F*4,p[1]+Math.cos(arg.oar_angle)*F*4];
        let o = spar(p,q,0.8);
        oars.lines.push(...o.lines);
      }
      layers.front.unshift(oars);
    }
    // the steering oar on the quarter
    let so = h.deck(0.88);
    hull_extra.push(spar([so[0]-F*0.2,so[1]-F*0.4],[so[0]+F*0.9,YW+F*1.5],1.6));
    let m = make_mast(h.deck(0.5),arg.rig_height*L,arg.rake,F*0.15);
    let ys = [0.8];
    let half = L*0.22*arg.sail_width;
    let c = m.at(ys[0]);
    let a = [c[0]-half,c[1]];
    let b = [c[0]+half,c[1]];
    layers.spars.push(spar(a,b,1.2));
    let fc = m.at(0.12);
    let BL = [fc[0]-half*1.05,fc[1]];
    let BR = [fc[0]+half*1.05,fc[1]];
    let hgt = dist(...a,...BL);
    layers.sails.push(make_sail(a,b,BL,BR,{bulgeL:hgt*0.06,bulgeR:hgt*0.06,belly:hgt*0.08,shade:arg.sail_shade,stripes:arg.stripes,seam:9}));
    layers.masts.push({lines:m.lines,occ:[m.poly]});
    layers.stays.push([m.head,bp.path[~~(bp.path.length*0.25)]],[m.head,sp.path[~~(sp.path.length*0.25)]]);
    layers.flags.push(flag(m.head,F*1.6,F*0.3,true,arg.sea_z));
  }

  // ---- ensign at the stern
  if (arg.type != 3){
    let st = h.sheer[h.sheer.length-1];
    let staff_top = [st[0]+F*0.5,st[1]-F*1.5];
    layers.rig.push([st,staff_top]);
    layers.flags.push(flag(staff_top,F*0.9,F*0.55,false,arg.sea_z+2));
  }

  // ---- rails
  if (arg.type == 0 || arg.type == 1){
    hull.lines.push(...deck_rail(h,0.03,0.97,F*(arg.type == 0 ? 0.18 : 0.1)));
  }else if (arg.type == 2){
    hull.lines.push(...deck_rail(h,0.02,0.98,F*0.12));
  }

  // ---- the sea, sized to the whole ship
  let pts = [h.outline,...hull_extra.map(e=>e.occ).flat(),...layers.sails.map(s=>s.occ).flat(),...layers.stays].flat();
  let xa = Math.min(...pts.map(p=>p[0]))-L*0.12;
  let xb = Math.max(...pts.map(p=>p[0]))+L*0.12;
  let ytop = Math.min(...pts.map(p=>p[1]));
  let s = sea(h,xa,xb,arg);

  let birds = {lines:gulls(xa,xb,ytop-L*0.02,ytop+L*0.12,arg.gulls),occ:[]};

  return compose([
    ...s.fronts,
    s.layer,
    ...layers.front,
    hull,
    ...hull_extra,
    {lines:layers.rig,occ:[]},
    ...behind,
    ...layers.spars,
    ...layers.sails,
    ...layers.masts,
    {lines:layers.stays,occ:[]},
    ...layers.flags,
    birds,
  ]);
}


// ---------------------------------------------------------------- parameters

function default_params(){
  return {
    type:0,
    hull_length:300,
    freeboard:24,
    sheer:1,
    sheer_pow:2.2,
    bow_rise:0.6,
    stern_rise:0.9,
    bow_rake:1,
    bow_curve:0.3,
    stern_overhang:0.6,
    transom:0,
    hull_tone:0.6,
    warship:0,
    ports:0,
    masts:3,
    tiers:3,
    rig_height:0.7,
    rake:0.05,
    furl:0.3,
    yard:1,
    reefs:0,
    spanker:1,
    jibs:2,
    bowsprit:0.25,
    bowsprit_angle:0.3,
    sail_shade:0.5,
    pennant:2,
    gaff_angle:0.6,
    topsail:0,
    bermuda:0,
    ketch:0,
    decks:2,
    deck_height:0.7,
    super_from:0.28,
    super_to:0.78,
    super_step:0.05,
    funnels:2,
    funnel_w:0.6,
    funnel_h:2,
    funnel_rake:0.1,
    funnel_band:1,
    smoke:6,
    mast_h:5,
    post_len:3,
    post_curl:3.6,
    oars:1,
    oar_angle:0.7,
    sail_width:1,
    stripes:8,
    chop:0.3,
    speed:0.6,
    sea_z:0,
    gulls:2,
  };
}

// the name decides some of the ship: SS, RMS and MV are steamers, HMS a man-of-war
function generate_params(name){
  let arg = default_params();
  let prefix = (name || '').trim().split(/\s+/)[0].toUpperCase();
  if (['SS','RMS','MV','SMS'].includes(prefix)){
    arg.type = 2;
  }else if (prefix == 'HMS'){
    arg.type = 0;
    arg.warship = 1;
  }else{
    arg.type = choice([0,1,2,3],[4,4,2,1.5]);
  }
  arg.sea_z = rand()*100;
  arg.chop = rndtri(0.1,0.3,0.6);
  arg.speed = rndtri(0,0.6,1);
  arg.gulls = choice([0,1,2,3],[3,2,2,1]);
  arg.sail_shade = rndtri(0.2,0.5,0.8);
  arg.rake = rndtri(0,0.05,0.12);

  if (arg.type == 0){
    arg.hull_length = rndtri(240,300,360);
    arg.freeboard = arg.hull_length*rndtri(0.07,0.085,0.1);
    arg.masts = arg.warship ? 3 : choice([1,2,3],[1,2,4]);
    arg.tiers = arg.masts == 1 ? choice([2,3]) : choice([2,3,4],[2,4,2]);
    arg.rig_height = rndtri(0.6,0.75,0.9)*(arg.masts == 1 ? 1.1 : 1);
    arg.sheer = rndtri(0.6,1,1.5);
    arg.bow_rise = rndtri(0.3,0.6,0.9);
    arg.stern_rise = rndtri(0.5,0.9,1.4);
    arg.bow_rake = rndtri(0.6,1,1.6);
    arg.bow_curve = rndtri(0,0.3,0.6);
    arg.stern_overhang = rndtri(0.2,0.6,1);
    arg.transom = choice([0,1]);
    arg.hull_tone = rndtri(0.35,0.6,0.85);
    arg.ports = arg.warship ? 1 : choice([0,1]);
    arg.furl = rndtri(0,0.3,0.8);
    arg.reefs = choice([0,0,1,2]);
    arg.spanker = choice([0,1],[1,3]);
    arg.jibs = choice([1,2,3],[1,3,2]);
    arg.bowsprit = rndtri(0.18,0.25,0.32);
    arg.bowsprit_angle = rndtri(0.2,0.3,0.45);
    arg.pennant = rndtri(1,2,3.5);
    arg.yard = rndtri(0.85,1,1.15);
  }else if (arg.type == 1){
    arg.hull_length = rndtri(200,260,320);
    arg.freeboard = arg.hull_length*rndtri(0.06,0.075,0.09);
    arg.masts = choice([1,2],[2,3]);
    arg.ketch = arg.masts == 2 ? choice([0,1],[3,1]) : 0;
    arg.rig_height = rndtri(0.55,0.7,0.9)*(arg.masts == 1 ? 1.15 : 1);
    arg.sheer = rndtri(0.4,0.8,1.2);
    arg.bow_rise = rndtri(0.4,0.7,1);
    arg.stern_rise = rndtri(0.2,0.5,0.8);
    arg.bow_rake = rndtri(0.4,1,1.8);
    arg.bow_curve = rndtri(0,0.3,0.6);
    arg.stern_overhang = rndtri(0.3,0.9,1.6);
    arg.transom = choice([0,1],[3,2]);
    arg.hull_tone = rndtri(0.2,0.45,0.8);
    arg.ports = choice([0,1],[3,1]);
    arg.gaff_angle = rndtri(0.45,0.6,0.8);
    arg.bermuda = choice([0,1],[4,1]);
    arg.topsail = arg.bermuda ? 0 : choice([0,1]);
    arg.reefs = choice([0,0,1]);
    arg.jibs = choice([1,2,3],[2,3,1]);
    arg.bowsprit = rndtri(0.1,0.18,0.25);
    arg.bowsprit_angle = rndtri(0.1,0.2,0.3);
    arg.pennant = rndtri(1,1.8,3);
  }else if (arg.type == 2){
    arg.hull_length = rndtri(300,360,420);
    arg.freeboard = arg.hull_length*rndtri(0.07,0.085,0.1);
    arg.sheer = rndtri(0.2,0.4,0.7);
    arg.bow_rise = rndtri(0.5,0.8,1);
    arg.stern_rise = rndtri(0.2,0.4,0.6);
    arg.bow_rake = rndtri(0,0.3,0.8);
    arg.bow_curve = rndtri(0,0.1,0.3);
    arg.stern_overhang = rndtri(0.4,0.8,1.2);
    arg.transom = 0;
    arg.hull_tone = rndtri(0.6,0.8,0.95);
    arg.decks = choice([1,2,3],[1,3,2]);
    arg.deck_height = rndtri(0.75,0.9,1.1);
    arg.super_from = rndtri(0.22,0.3,0.38);
    arg.super_to = rndtri(0.65,0.75,0.82);
    arg.super_step = rndtri(0.02,0.05,0.08);
    arg.funnels = choice([1,2,3,4],[3,3,2,1]);
    arg.funnel_w = rndtri(0.75,0.95,1.2);
    arg.funnel_h = rndtri(2.2,2.8,3.6);
    arg.funnel_rake = rndtri(0,0.1,0.2);
    arg.funnel_band = choice([0,1]);
    arg.smoke = choice([0,4,6,8],[1,2,2,1]);
    arg.mast_h = rndtri(2.6,3.4,4.2);
  }else{
    arg.hull_length = rndtri(260,300,340);
    arg.freeboard = arg.hull_length*rndtri(0.032,0.038,0.045);
    arg.sheer = rndtri(4,5,6);
    arg.sheer_pow = rndtri(3,3.6,4.4);
    arg.bow_rise = rndtri(0.9,1,1.1);
    arg.stern_rise = rndtri(0.85,0.95,1.05);
    arg.bow_rake = rndtri(2.2,3,3.8);
    arg.bow_curve = rndtri(0.6,1,1.4);
    arg.stern_overhang = rndtri(2,2.8,3.6);
    arg.transom = 0;
    arg.hull_tone = rndtri(0.55,0.65,0.75);
    arg.post_len = rndtri(7,9,11.5);
    arg.post_curl = rndtri(3.8,4.5,5.2);
    arg.oars = choice([0,1],[1,3]);
    arg.oar_angle = rndtri(0.4,0.7,1);
    arg.rig_height = rndtri(0.32,0.4,0.48);
    arg.sail_width = rndtri(0.8,1,1.2);
    arg.stripes = choice([0,6,8,10],[1,2,2,1]);
  }
  return arg;
}


// ---------------------------------------------------------------- names

const SHIP_ADJ = ['Northern','Southern','Western','Silver','Golden','Swift','Bold','Fair','Gallant','Noble','Royal','Iron','Lucky','Restless','Crimson','Morning','Evening','Wandering','Brave','Merry','Stormy','Quiet','Faithful','Grey','Black','White','Flying','Rising','Lonely','Hopeful'];
const SHIP_NOUN = ['Star','Gull','Wind','Tide','Albatross','Heron','Petrel','Mariner','Venture','Spirit','Fortune','Promise','Rover','Pilgrim','Dawn','Horizon','Comet','Swallow','Osprey','Cormorant','Dolphin','Narwhal','Kraken','Current','Lantern','Compass','Anchor','Harbour','Seal','Whale'];
const SHIP_ONE = ['Endeavour','Resolute','Intrepid','Dauntless','Valiant','Victory','Discovery','Adventure','Terror','Erebus','Beagle','Bounty','Calypso','Fram','Mayflower','Nautilus','Argo','Endurance','Aurora','Hesperus','Ariadne','Ophelia','Persephone','Cassiopeia','Orion','Triton','Neptune','Mercury','Juno','Minerva','Clementine','Matilda','Isabella','Henrietta','Perseverance','Constance','Serenity','Tenacity','Vigilant','Undaunted'];
const SHIP_TITLE = ['Lady','Queen','Princess','Duchess','Countess'];
const SHIP_GIVEN = ['Margaret','Elizabeth','Charlotte','Eleanor','Catherine','Mary','Anne','Victoria','Louisa','Harriet','Sophia','Adelaide'];
const SHIP_PREFIX = ['HMS','SS','RMS','MV','The',''];

function ship_name(){
  let prefix = choice(SHIP_PREFIX,[3,3,1.5,1,2,5]);
  let r = rand();
  let body;
  if (r < 0.45){
    body = choice(SHIP_ONE);
  }else if (r < 0.85){
    body = choice(SHIP_ADJ)+' '+choice(SHIP_NOUN);
  }else{
    body = choice(SHIP_TITLE)+' '+choice(SHIP_GIVEN);
  }
  return (prefix ? prefix+' ' : '')+body;
}

function reframe(polylines,pad=20,text=null){
  
  let W = (500-pad*2);
  let H = (300-pad*2) - (text?10:0);
  let bbox = get_bbox(polylines.flat());
  let sw = W/bbox.w;
  let sh = H/bbox.h;
  let s = Math.min(sw,sh);
  let px = (W-bbox.w*s)/2;
  let py = (H-bbox.h*s)/2;
  for (let i = 0; i < polylines.length; i++){
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      x = (x - bbox.x) * s + px+pad;
      y = (y - bbox.y) * s + py+pad;
      polylines[i][j] = [x,y];
    }
  }
  let [tw,tp] = put_text(text);
  tp = tp.map(p=>scl_poly(shr_poly(p,-0.3),0.3,0.3));
  tw *= 0.3;
  polylines.push(...tp.map(p=>trsl_poly(p,250-tw/2,300-pad+5)));
  return polylines;
}

function cleanup(polylines){
  for (let i = polylines.length-1; i>=0; i--){
    polylines[i] = approx_poly_dp(polylines[i],0.1);
    for (let j = 0; j < polylines[i].length; j++){
      for (let k = 0; k < polylines[i][j].length; k++){
        polylines[i][j][k] = ~~(polylines[i][j][k]*10000)/10000;
      }
    }
    if (polylines[i].length < 2){
      polylines.splice(i,1);
      continue;
    }
    if (polylines[i].length == 2){
      if (dist(...polylines[0],...polylines[1])<0.9){
        polylines.splice(i,1);
        continue;
      }
    }
  }
  return polylines;
}


// beaks after the feeding guilds of Wikipedia's chart File:BirdBeaksA.svg. Lengths and depths
// are in head radii as [min, mode, max]; w is how often the beak is picked (fruit eating,
// and filter feeding are rare)

function choice(opts,percs){
  if (!percs){
    percs = opts.map(x=>1);
  }
  let s = 0;
  for (let i = 0; i < percs.length; i++){
    s += percs[i];
  }
  let r = rand()*s;
  s = 0;
  for (let i = 0; i < percs.length; i++){
    s += percs[i];
    if (r <= s){
      return opts[i];
    }
  }
}

function rndtri(a,b,c){
  let s0 = (b-a)/2;
  let s1 = (c-b)/2;
  let s = s0 + s1;
  let r = rand()*s;
  if (r < s0){
    //d * d/(b-a) / 2 = r;
    let d = Math.sqrt(2*r*(b-a));
    return a + d;
  }
  //d * d/(c-b) / 2 = s-r;
  let d = Math.sqrt(2*(s-r)*(c-b));
  return c-d;
}

let hershey_raw = {
"501":"  9I[RFJ[ RRFZ[ RMTWT",
"502":" 24G\\KFK[ RKFTFWGXHYJYLXNWOTP RKPTPWQXRYTYWXYWZT[K[",
"503":" 19H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZV",
"504":" 16G\\KFK[ RKFRFUGWIXKYNYSXVWXUZR[K[",
"505":" 12H[LFL[ RLFYF RLPTP RL[Y[",
"506":"  9HZLFL[ RLFYF RLPTP",
"507":" 23H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZVZS RUSZS",
"508":"  9G]KFK[ RYFY[ RKPYP",
"509":"  3NVRFR[",
"510":" 11JZVFVVUYTZR[P[NZMYLVLT",
"511":"  9G\\KFK[ RYFKT RPOY[",
"512":"  6HYLFL[ RL[X[",
"513":" 12F^JFJ[ RJFR[ RZFR[ RZFZ[",
"514":"  9G]KFK[ RKFY[ RYFY[",
"515":" 22G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF",
"516":" 14G\\KFK[ RKFTFWGXHYJYMXOWPTQKQ",
"517":" 25G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RSWY]",
"518":" 17G\\KFK[ RKFTFWGXHYJYLXNWOTPKP RRPY[",
"519":" 21H\\YIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX",
"520":"  6JZRFR[ RKFYF",
"521":" 11G]KFKULXNZQ[S[VZXXYUYF",
"522":"  6I[JFR[ RZFR[",
"523":" 12F^HFM[ RRFM[ RRFW[ R\\FW[",
"524":"  6H\\KFY[ RYFK[",
"525":"  7I[JFRPR[ RZFRP",
"526":"  9H\\YFK[ RKFYF RK[Y[",
"601":" 18I\\XMX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"602":" 18H[LFL[ RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
"603":" 15I[XPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"604":" 18I\\XFX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"605":" 18I[LSXSXQWOVNTMQMONMPLSLUMXOZQ[T[VZXX",
"606":"  9MYWFUFSGRJR[ ROMVM",
"607":" 23I\\XMX]W`VaTbQbOa RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"608":" 11I\\MFM[ RMQPNRMUMWNXQX[",
"609":"  9NVQFRGSFREQF RRMR[",
"610":" 12MWRFSGTFSERF RSMS^RaPbNb",
"611":"  9IZMFM[ RWMMW RQSX[",
"612":"  3NVRFR[",
"613":" 19CaGMG[ RGQJNLMOMQNRQR[ RRQUNWMZM\\N]Q][",
"614":" 11I\\MMM[ RMQPNRMUMWNXQX[",
"615":" 18I\\QMONMPLSLUMXOZQ[T[VZXXYUYSXPVNTMQM",
"616":" 18H[LMLb RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
"617":" 18I\\XMXb RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"618":"  9KXOMO[ ROSPPRNTMWM",
"619":" 18J[XPWNTMQMNNMPNRPSUTWUXWXXWZT[Q[NZMX",
"620":"  9MYRFRWSZU[W[ ROMVM",
"621":" 11I\\MMMWNZP[S[UZXW RXMX[",
"622":"  6JZLMR[ RXMR[",
"623":" 12G]JMN[ RRMN[ RRMV[ RZMV[",
"624":"  6J[MMX[ RXMM[",
"625":" 10JZLMR[ RXMR[P_NaLbKb",
"626":"  9J[XMM[ RMMXM RM[X[",
"710":"  6MWRYQZR[SZRY",
};

let hershey_cache = {};

function compile_hershey(i){
  if (hershey_cache[i]){
    return hershey_cache[i];
  }
  var entry = hershey_raw[i];
  if (entry == null){
    return;
  }
  var ordR = 82;
  var bound= entry.substring(3,5);
  var xmin = bound.charCodeAt(0)-ordR;
  var xmax = bound.charCodeAt(1)-ordR;
  var content = entry.substring(5);
  var polylines = [[]];
  var j  = 0;
  while (j < content.length){
    var digit = content.substring(j,j+2);
    if (digit == " R"){
      polylines.push([]);
    }else{
      var x  = digit.charCodeAt(0)-ordR;
      var y  = digit.charCodeAt(1)-ordR;
      polylines[polylines.length-1].push([x,y]);
    }
    j+=2;
  }
  let data = {
    xmin:xmin,
    xmax:xmax,
    polylines:polylines,
  };
  hershey_cache[i] = data;
  return data;
}

function put_text(txt){
  let base = 500;
  let x = 0;
  let o = [];
  for (let i = 0; i < txt.length; i++){
    let ord = txt.charCodeAt(i);
    let idx;
    if (65 <= ord && ord <= 90){
      idx = base+1+(ord-65);
    }else if (97 <= ord && ord <= 122){
      idx = base + 101+(ord-97);
    }else if (ord == 46){
      idx = 710;
    }else if (ord == 32){
      x += 10;
      continue;
    }else{
      continue;
    }
    let {xmin,xmax,polylines} = compile_hershey(idx);
    polylines = polylines.map(p=>trsl_poly(p,x-xmin,0));
    o.push(...polylines);
    x += (xmax-xmin);
  }
  return [x,o];
}

function str_to_seed(str){
  let n = 1;
  for (let i = 0; i < str.length; i++){
    let x = str.charCodeAt(i)+1;
    n ^= x << (7+(i%5));
    // if (i % 2){
      n ^=(n<<17);
      n ^=(n>>13);
      n ^=(n<<5);
    // }
    n = (n>>>0) % 4294967295;
  }
  return n;
}

function main(seed){
  if (seed === undefined){
    jsr = ~~(Math.random()*10000);
    seed = ship_name();
  }
  jsr = str_to_seed(seed);
  let drawing = ship(generate_params(seed));
  return (cleanup(reframe(drawing,20,seed+'.')));
}


if (typeof module != "undefined"){
  module.exports = {main,generate_params,default_params,ship,reframe,cleanup,draw_svg,ship_name,str_to_seed};
  if (require.main === module) {
    let seed = undefined;
    let format = 'svg';
    let speed = 0.005;
    for (let i = 2; i < process.argv.length; i++){
      let a = process.argv[i];
      if (a == '--seed'){
        seed = process.argv[i+1];
      }else if (a == '--format'){
        format = process.argv[i+1];
      }else if (a == '--speed'){
        if (process.argv[i+1] > 0)
          speed = speed / process.argv[i+1];
      }
    }
    let polylines = main(seed);
    if (format == 'svg'){
      console.log(draw_svg(polylines));
    }else if (format == 'json'){
      console.log(JSON.stringify(polylines));
    }else if (format == 'smil'){
      console.log(draw_svg_anim(polylines,speed));
    }else if (format == 'csv'){
      console.log(polylines.map(x=>x.flat().join(',')).join('\n'));
    }else if (format == 'ps'){
      console.log(draw_ps(polylines));
    }
  }
}
