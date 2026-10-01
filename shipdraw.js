
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
  if (o.seam === 0){
    // no seams
  }else if (dist(...TL,...TR) > 1e-6){
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
  // battens: stiff bamboo laths across the sail, drawn double
  for (let k = 1; k <= (o.battens || 0); k++){
    let g = k/(o.battens+1);
    let a = [];
    let b = [];
    for (let i = 0; i <= n; i++){
      let p = P(i/n,g);
      a.push(p);
      b.push([p[0],p[1]+1.3]);
    }
    lines.push(a,b);
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
  return {lines,occ:[outline],P};
}

// a sail furled on its yard: a fat roll with lashings
function furled(a,b){
  let path = resample([a,b],1.5);
  let [l,r] = tube(path,u=>1.8*Math.pow(Math.sin(PI*Math.min(0.98,Math.max(0.02,u))),0.3));
  let lines = [l,r];
  for (let i = 3; i < path.length-3; i += 4) lines.push([l[i],r[i]]);
  return {lines,occ:[l.concat(r.slice().reverse())]};
}

// a spar (yard, boom, gaff, bowsprit) between two points. It reaches a little past both ends,
// as yardarms do, so a sail corner sits inside the spar rather than on its end
function spar(a,b,w){
  let e = w*2/(dist(...a,...b) || 1);
  [a,b] = [lerp2d(...a,...b,-e),lerp2d(...a,...b,1+e)];
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

// ---------------------------------------------------------------- more rigs

// a lateen sail: a long yard slung across the masthead, low at the fore end and high aft,
// with a triangular sail hanging from it
function lateen_rig(m,arg,len,ang,layers){
  let c = m.at(0.9);
  let d = [Math.cos(ang),-Math.sin(ang)];
  let lo = [c[0]-d[0]*len*0.4,c[1]-d[1]*len*0.4];
  let hi = [c[0]+d[0]*len*0.6,c[1]+d[1]*len*0.6];
  let foot = m.at(0.1);
  let clew = [m.base[0]+len*0.42,foot[1]];
  layers.spars.push(spar(lo,hi,1.2));
  let hgt = dist(...hi,...clew);
  let s = make_sail(hi,hi,lo,clew,{bulgeR:hgt*0.08,belly:len*0.05,shade:arg.sail_shade,seam:7});
  layers.sails.push(s);
  layers.rig.push([clew,[clew[0]+len*0.08,foot[1]+m.height*0.12]]);
  return hi;
}

// a junk sail: a lug sail stiffened by battens, the yard rising aft, the sheets fanning down
// from each batten to one block on the deck
function junk_rig(m,arg,w,layers){
  let top = m.at(0.94);
  let bot = m.at(0.1);
  let TL = [top[0]-w*0.18,top[1]+w*0.05];
  let TR = [top[0]+w*0.72,top[1]-w*0.2];
  let BL = [bot[0]-w*0.22,bot[1]];
  let BR = [bot[0]+w*0.82,bot[1]-w*0.04];
  let hgt = dist(...TL,...BL);
  let nb = arg.battens;
  let s = make_sail(TL,TR,BL,BR,{bulgeR:hgt*0.14,bulgeL:hgt*0.02,belly:0,seam:0,battens:nb,shade:arg.sail_shade*0.6});
  layers.sails.push(s);
  layers.spars.push(spar(TL,TR,1.2),spar(BL,BR,1.1));
  let block = [BR[0]+w*0.25,m.base[1]+m.height*0.03];
  for (let k = 1; k <= nb; k += 2){
    layers.rig.push([s.P(1,k/(nb+1)),block]);
  }
}

// a spritsail: a small square sail hanging under the bowsprit
function spritsail(bow,tip,w,ht,arg,layers){
  let c = lerp2d(...bow,...tip,0.62);
  let a = [c[0]-w/2,c[1]];
  let b = [c[0]+w/2,c[1]];
  layers.spars.push(spar(a,b,0.9));
  let s = make_sail(a,b,[a[0]-w*0.04,c[1]+ht],[b[0]+w*0.04,c[1]+ht],{bulgeL:ht*0.03,bulgeR:ht*0.03,belly:ht*0.1,shade:arg.sail_shade,seam:6});
  layers.sails.unshift(s);
}


// ---------------------------------------------------------------- structures

// a deckhouse: a box with a shadow under its roof, a row of windows and a rail on top
function deckhouse(x0,x1,y0,y1,F,o){
  o = o || {};
  let poly = [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  let lines = [];
  for (let k = 1; k <= 3; k++) lines.push([[x0,y0+k*1.3],[x1,y0+k*1.3]]);
  let wins = [];
  if (o.windows !== false){
    let ww = F*(o.win || 0.1);
    let wy = lerp(y0,Math.min(y1,y0+F*(o.ht || 0.8)),0.55);
    for (let x = x0+F*0.3; x < x1-F*0.2; x += F*(o.pitch || 0.24)){
      let p = o.round ? ellipse(x+ww/2,wy,ww*0.5,ww*0.5,0,10) : [[x,wy-ww*0.7],[x+ww,wy-ww*0.7],[x+ww,wy+ww*0.7],[x,wy+ww*0.7],[x,wy-ww*0.7]];
      wins.push(p);
    }
  }
  lines = clip_out(lines,wins).concat(wins,[[[x0,y1],[x0,y0],[x1,y0],[x1,y1]]]);
  if (o.rail !== false){
    lines.push(...deck_rail({deck:t=>[lerp(x0,x1,t),y0]},0,1,F*0.12));
  }
  return {lines,occ:[poly]};
}

// a raised castle on the deck (galleons): its top follows the sheer, its ends lean outward,
// it has windows, a rail and the same engraved tone as the hull
function castle(h,t0,t1,base,ht,tone){
  let F = h.F;
  let top = [];
  let bot = [];
  for (let t = t0; t <= t1+1e-6; t += 0.01){
    let [x,y] = h.deck(t);
    bot.push([x,y-base+2]);
    top.push([x,y-base-ht]);
  }
  let lean = ht*0.25;
  top[0] = [top[0][0]-lean*(t0 > 0.5 ? 1 : 0),top[0][1]];
  top[top.length-1] = [top[top.length-1][0]+lean*(t1 < 0.5 ? 1 : 0),top[top.length-1][1]];
  let poly = top.concat(bot.slice().reverse());
  let lines = [];
  for (let k = 0.15; k < 1; k += lerp(0.25,0.12,tone)){
    lines.push(top.map((p,i)=>lerp2d(...p,...bot[i],k)));
  }
  let wins = [];
  for (let i = 2; i < top.length-2; i += 3){
    let p = lerp2d(...top[i],...bot[i],0.45);
    let w = F*0.13;
    let win = [[p[0]-w/2,p[1]+w*0.6],[p[0]-w/2,p[1]-w*0.3],[p[0],p[1]-w*0.7],[p[0]+w/2,p[1]-w*0.3],[p[0]+w/2,p[1]+w*0.6],[p[0]-w/2,p[1]+w*0.6]];
    wins.push(win);
  }
  lines = clip_multi(lines,poly).true;
  lines = clip_out(lines,wins).concat(wins,[poly.concat([poly[0]])]);
  lines.push(...deck_rail({deck:t=>lerp2d(...top[0],...top[top.length-1],t)},0,1,F*0.14));
  return {lines,occ:[poly]};
}

// a painted eye at the bow (junks, galleys)
function bow_eye(h){
  let [x,y] = h.deck(0.07);
  y = lerp(y,YW,0.45);
  let r = h.F*0.22;
  let eye = [];
  for (let i = 0; i <= 20; i++){
    let a = i/20*PI*2;
    eye.push([x+Math.cos(a)*r,y+Math.sin(a)*r*0.55*(Math.sin(a) > 0 ? 1 : 1.2)]);
  }
  let pupil = ellipse(x-r*0.15,y,r*0.32,r*0.32,0,12);
  return {lines:[eye,pupil,...fill_shape(pupil,0.7)],occ:[eye]};
}

// fenders: worn rope or tyre bumpers hung over the side (tugs)
function fenders(h,t0,t1,step){
  let lines = [];
  let occ = [];
  for (let t = t0; t <= t1; t += step){
    let [x,y] = h.deck(t);
    let f = ellipse(x,y+h.F*0.32,h.F*0.13,h.F*0.24,0,14);
    lines.push(f,[[x,y-h.F*0.05],[x,y+h.F*0.08]],...clip_multi(shade_shape(f,1.4,2,2),f).true);
    occ.push(f);
  }
  return {lines,occ};
}

// a paddle box: the half-round housing of a side wheel, with a sunburst of slats
function paddle_box(c,R,F){
  let arc = [];
  for (let i = 0; i <= 32; i++){
    let a = PI+i/32*PI;
    arc.push([c[0]+Math.cos(a)*R,c[1]+Math.sin(a)*R]);
  }
  let poly = arc.concat([[c[0]+R,YW+F],[c[0]-R,YW+F]]);
  let lines = [arc,[[c[0]-R,c[1]],[c[0]-R,YW+F]],[[c[0]+R,c[1]],[c[0]+R,YW+F]]];
  let inner = arc.map(p=>lerp2d(...c,...p,0.82));
  let hub = arc.map(p=>lerp2d(...c,...p,0.28));
  lines.push(inner,hub,[[c[0]-R*0.82,c[1]],[c[0]+R*0.82,c[1]]]);
  for (let i = 1; i < 12; i++){
    let a = PI+i/12*PI;
    lines.push([[c[0]+Math.cos(a)*R*0.28,c[1]+Math.sin(a)*R*0.28],[c[0]+Math.cos(a)*R*0.82,c[1]+Math.sin(a)*R*0.82]]);
  }
  // the lower housing, hatched
  let low = [[c[0]-R,c[1]+1],[c[0]+R,c[1]+1],[c[0]+R,YW+F],[c[0]-R,YW+F]];
  lines.push(...fill_shape(low,2.4));
  return {lines,occ:[poly]};
}

// an armoured turret: a drum with gun ports and barrels pointing fore or aft
function turret(c,w,ht,F,dir){
  let r = ht*0.35;
  let poly = [[c[0]-w/2,c[1]],[c[0]-w/2,c[1]-ht+r],[c[0]-w/2+r,c[1]-ht],[c[0]+w/2-r,c[1]-ht],[c[0]+w/2,c[1]-ht+r],[c[0]+w/2,c[1]]];
  let lines = [poly.concat([poly[0]])];
  // rounded shading toward the after side, and plating seams
  for (let x = c[0]+w*0.12; x < c[0]+w/2; x += 1.6) lines.push([[x,c[1]-ht+r*0.5],[x,c[1]]]);
  lines.push([[c[0]-w/2,c[1]-ht*0.45],[c[0]+w/2,c[1]-ht*0.45]]);
  let gx = dir < 0 ? c[0]-w/2 : c[0]+w/2;
  let gy = c[1]-ht*0.55;
  let barrel = spar([gx,gy],[gx+dir*F*1.8,gy-F*0.05],F*0.09);
  return {lines:clip_multi(lines.slice(1),poly).true.concat([lines[0]],barrel.lines),occ:[poly,...barrel.occ]};
}

// an armoured casemate: a box with sloping ends and a row of gun ports
function casemate(x0,x1,y1,ht,F){
  let poly = [[x0,y1],[x0+ht*0.7,y1-ht],[x1-ht*0.7,y1-ht],[x1,y1]];
  let lines = [];
  for (let x = x0-ht*0.2; x < x1; x += 2.2) lines.push([[x-0.7,y1+1],[x+ht*0.7+0.7,y1-ht-1]]);
  lines = clip_multi(lines,poly.concat([poly[0]])).true;
  let ports = [];
  for (let x = x0+ht*1.1; x < x1-ht*1.1; x += F*0.9){
    let p = [[x,y1-ht*0.65],[x+F*0.28,y1-ht*0.65],[x+F*0.28,y1-ht*0.35],[x,y1-ht*0.35]];
    ports.push(p);
  }
  lines = clip_out(lines,ports);
  for (let p of ports) lines.push(p.concat([p[0]]),...fill_shape(p,0.8));
  lines.push(poly.concat([poly[0]]));
  return {lines,occ:[poly]};
}

// a thin pole mast with a crosstree (steam ships)
function pole_mast(ctx,t,ht,rake){
  let m = make_mast(ctx.h.deck(t),ht,rake,ctx.F*0.09);
  ctx.layers.masts.push({lines:m.lines,occ:[m.poly]});
  let c = m.at(0.82);
  ctx.layers.rig.push([[c[0]-ctx.F*0.3,c[1]],[c[0]+ctx.F*0.3,c[1]]]);
  return m;
}


// ---------------------------------------------------------------- the ship

// the bowsprit and the dolphin striker under it; returns the tip
function bowsprit(ctx,len,ang){
  let {h,F} = ctx;
  let bow_top = h.sheer[0];
  let tip = [bow_top[0]-Math.cos(ang)*len,bow_top[1]-Math.sin(ang)*len];
  let root = [bow_top[0]+F*0.6,bow_top[1]+F*0.15];
  ctx.hull_extra.push(spar(root,tip,1.4));
  let ds = lerp2d(...root,...tip,0.62);
  let dsb = [ds[0],ds[1]+F*0.5];
  ctx.layers.rig.push([ds,dsb],[dsb,tip],[dsb,h.bow[~~(h.bow.length*0.45)]]);
  ctx.tip = tip;
  return tip;
}

// a sailing rig from a plan: one entry per mast, fore to aft, each with its own kind of sail
function sail_plan(ctx,plan){
  let {h,L,F,arg,layers} = ctx;
  let ms = plan.map(p=>make_mast(h.deck(p.t),arg.rig_height*L*p.h,p.rake === undefined ? arg.rake : p.rake,F*0.12*(p.w || 1)));
  let gap = i=>{
    let d = [];
    if (i > 0) d.push(ms[i].base[0]-ms[i-1].base[0]);
    if (i < ms.length-1) d.push(ms[i+1].base[0]-ms[i].base[0]);
    return d.length ? Math.min(...d) : L*0.4;
  };
  for (let i = ms.length-1; i >= 0; i--){
    let m = ms[i];
    let p = plan[i];
    let ys = [0.6];
    if (p.kind == 'square'){
      if (p.spanker){
        let boom = h.xs-m.base[0]+F*0.6;
        gaff_rig(m,Object.assign({},arg,{topsail:0,reefs:0}),boom,layers,false);
        ys = square_rig({at:u=>m.at(0.7+u*0.3),aft:m.aft},arg,Math.max(1,p.tiers-1),gap(i)*0.45*p.h*arg.yard,layers).map(u=>0.7+u*0.3);
      }else{
        ys = square_rig(m,arg,p.tiers,gap(i)*0.58*p.h*arg.yard,layers);
      }
      for (let u of ys){
        let c = m.at(u-0.03);
        layers.rig.push([[c[0]-F*0.35,c[1]],[c[0]+F*0.35,c[1]]]);
      }
      layers.rig.push(...shrouds(h,m,ys[0]-0.02,4,F*0.9));
    }else if (p.kind == 'gaff'){
      let boom = i < ms.length-1 ? (ms[i+1].base[0]-m.base[0])*0.9 : (h.xs-m.base[0])*0.95;
      gaff_rig(m,Object.assign({},arg,{topsail:p.topsail === undefined ? arg.topsail : p.topsail}),boom*(p.boom || 1),layers,p.bermuda);
      layers.rig.push(...shrouds(h,m,0.62,3,F*0.5));
    }else if (p.kind == 'lateen'){
      lateen_rig(m,arg,arg.lateen_len*L*p.h,arg.lateen_angle,layers);
      layers.rig.push(...shrouds(h,m,0.8,2,F*0.6));
    }else if (p.kind == 'junk'){
      junk_rig(m,arg,gap(i)*0.95*p.h,layers);
    }
    layers.masts.push({lines:m.lines,occ:[m.poly],head:m.head});
    if (i > 0 && p.kind != 'junk') layers.stays.push([m.head,ms[i-1].at(p.kind == 'square' ? 0.38 : 0.7)]);
  }
  if (plan[0].kind != 'junk'){
    layers.stays.push([ms[0].head,ctx.tip || h.sheer[0]]);
  }
  let tall = ms.reduce((a,m)=>(m.head[1] < a.head[1] ? m : a),ms[0]);
  layers.flags.push(flag(tall.head,F*arg.pennant,F*0.16,true,arg.sea_z));
  return ms;
}

// what each kind of ship is made of: its parameters, and how it is built on its hull
const KINDS = {

  // a full-rigged ship: three masts of square sails, often a spanker aft; HMS ships carry two
  // decks of guns
  ship:{
    params(arg){
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
    },
    build(ctx){
      let {h,L,arg} = ctx;
      let rows = arg.warship ? [0.13,0.27] : (arg.ports ? [0.16] : []);
      ctx.dark = k=>{
        for (let r of rows) if (Math.abs(k-r) < 0.055) return 0;
        return k < 0.025 ? 0 : 1;
      };
      for (let r of rows) ctx.holes.push(gunports(h,r,ctx.F*0.13,0.12,0.88,0.05));
      ctx.holes.push(stern_windows(h,2,3));
      ctx.rail = 0.18;
      let tip = bowsprit(ctx,arg.bowsprit*L,arg.bowsprit_angle);
      let n = arg.masts;
      let ts = n == 3 ? [0.2,0.47,0.74] : n == 2 ? [0.28,0.62] : [0.42];
      let hs = n == 3 ? [0.93,1,0.8] : n == 2 ? [0.95,1] : [1];
      let ms = sail_plan(ctx,ts.map((t,i)=>({t,h:hs[i],kind:'square',tiers:Math.max(1,arg.tiers-(i == 2 ? 1 : 0)),spanker:arg.spanker && n > 1 && i == n-1})));
      jibs(ms[0],lerp2d(...h.sheer[0],...tip,0.15),tip,arg.jibs,arg,ctx.layers);
    },
  },

  // brigantine (two masts) or barquentine (three): square sails on the foremast only, gaff
  // sails on the others
  brig:{
    params(arg){
      KINDS.ship.params(arg);
      arg.masts = choice([2,3],[3,2]);
      arg.tiers = choice([2,3,4],[2,4,2]);
      arg.topsail = choice([0,1],[1,2]);
      arg.gaff_angle = rndtri(0.45,0.6,0.8);
      arg.ports = choice([0,1],[3,1]);
    },
    build(ctx){
      let {h,L,arg} = ctx;
      ctx.dark = k=>(k < 0.025 ? 0 : 1);
      if (arg.ports) ctx.holes.push(gunports(h,0.16,ctx.F*0.12,0.15,0.85,0.06));
      ctx.holes.push(stern_windows(h,1,3));
      ctx.rail = 0.15;
      let tip = bowsprit(ctx,arg.bowsprit*L,arg.bowsprit_angle);
      let plan = arg.masts == 2
        ? [{t:0.3,h:0.95,kind:'square',tiers:arg.tiers},{t:0.6,h:1,kind:'gaff'}]
        : [{t:0.22,h:0.95,kind:'square',tiers:arg.tiers},{t:0.5,h:1,kind:'gaff'},{t:0.76,h:0.9,kind:'gaff'}];
      let ms = sail_plan(ctx,plan);
      jibs(ms[0],lerp2d(...h.sheer[0],...tip,0.15),tip,arg.jibs,arg,ctx.layers);
    },
  },

  // a clipper: a long sharp hull with a hollow bow, and a towering rig of many square sails
  clipper:{
    params(arg){
      KINDS.ship.params(arg);
      arg.hull_length = rndtri(300,340,380);
      arg.freeboard = arg.hull_length*rndtri(0.06,0.07,0.08);
      arg.masts = 3;
      arg.tiers = choice([4,5],[2,1]);
      arg.rig_height = rndtri(0.85,0.95,1.05);
      arg.sheer = rndtri(0.5,0.8,1.1);
      arg.bow_rake = rndtri(1.8,2.4,3);
      arg.bow_curve = rndtri(0.5,0.8,1.1);
      arg.stern_overhang = rndtri(0.6,0.9,1.2);
      arg.transom = 0;
      arg.hull_tone = rndtri(0.7,0.85,0.95);
      arg.ports = 0;
      arg.furl = rndtri(0,0.15,0.4);
      arg.spanker = 1;
      arg.jibs = 3;
      arg.bowsprit = rndtri(0.25,0.3,0.36);
      arg.yard = rndtri(0.9,1,1.1);
    },
    build(ctx){
      let {h,L,arg} = ctx;
      ctx.dark = k=>(k < 0.03 ? 0 : 1);
      ctx.rail = 0.12;
      let tip = bowsprit(ctx,arg.bowsprit*L,arg.bowsprit_angle);
      let ms = sail_plan(ctx,[
        {t:0.22,h:0.94,kind:'square',tiers:arg.tiers},
        {t:0.48,h:1,kind:'square',tiers:arg.tiers},
        {t:0.73,h:0.86,kind:'square',tiers:arg.tiers-1,spanker:1},
      ]);
      jibs(ms[0],lerp2d(...h.sheer[0],...tip,0.15),tip,arg.jibs,arg,ctx.layers);
    },
  },

  // a galleon: castles fore and aft, a row of guns, square sails forward and lateens aft,
  // and a spritsail under the steep bowsprit
  galleon:{
    params(arg){
      KINDS.ship.params(arg);
      arg.hull_length = rndtri(240,270,300);
      arg.freeboard = arg.hull_length*rndtri(0.09,0.1,0.11);
      arg.masts = choice([3,4],[3,1]);
      arg.tiers = choice([2,3],[2,1]);
      arg.rig_height = rndtri(0.6,0.7,0.8);
      arg.sheer = rndtri(1,1.3,1.6);
      arg.sheer_pow = rndtri(1.6,2,2.4);
      arg.bow_rise = rndtri(0.4,0.6,0.8);
      arg.stern_rise = rndtri(1.2,1.6,2);
      arg.bow_rake = rndtri(1.4,1.8,2.2);
      arg.stern_overhang = rndtri(0.1,0.3,0.5);
      arg.transom = 1;
      arg.hull_tone = rndtri(0.45,0.6,0.8);
      arg.bowsprit = rndtri(0.2,0.24,0.28);
      arg.bowsprit_angle = rndtri(0.45,0.55,0.65);
      arg.lateen_len = rndtri(0.32,0.38,0.44);
      arg.lateen_angle = rndtri(0.5,0.6,0.7);
      arg.castle = rndtri(0.9,1.1,1.4);
      arg.furl = rndtri(0,0.2,0.5);
    },
    build(ctx){
      let {h,L,F,arg} = ctx;
      ctx.dark = k=>(Math.abs(k-0.17) < 0.05 ? 0 : 1);
      ctx.holes.push(gunports(h,0.17,F*0.13,0.18,0.72,0.055));
      ctx.rail = 0.15;
      ctx.behind.push(castle(h,0.8,1,0,F*arg.castle,arg.hull_tone),castle(h,0.9,1,F*arg.castle,F*arg.castle*0.7,arg.hull_tone),castle(h,0,0.12,0,F*0.8,arg.hull_tone));
      let tip = bowsprit(ctx,arg.bowsprit*L,arg.bowsprit_angle);
      let plan = [{t:0.25,h:0.85,kind:'square',tiers:arg.tiers},{t:0.5,h:1,kind:'square',tiers:arg.tiers+1},{t:0.72,h:0.75,kind:'lateen'}];
      if (arg.masts == 4) plan.push({t:0.86,h:0.6,kind:'lateen'});
      sail_plan(ctx,plan);
      spritsail(h.sheer[0],tip,L*0.12,F*1.6,arg,ctx.layers);
    },
  },

  // schooner, sloop or ketch: fore-and-aft sails, gaff or triangular, with headsails
  schooner:{
    params(arg){
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
    },
    build(ctx){
      let {h,L,F,arg} = ctx;
      ctx.dark = k=>(k < 0.2 ? 0.45 : 1);
      if (arg.ports) ctx.holes.push(portholes(h,0.12,F*0.07,0.2,0.75,0.08));
      ctx.rail = 0.1;
      let tip = bowsprit(ctx,arg.bowsprit*L,arg.bowsprit_angle);
      let plan = arg.masts == 2
        ? [{t:0.3,h:arg.ketch ? 1 : 0.92,kind:'gaff',bermuda:arg.bermuda},{t:0.6,h:arg.ketch ? 0.75 : 1,kind:'gaff',bermuda:arg.bermuda}]
        : [{t:0.38,h:1,kind:'gaff',bermuda:arg.bermuda}];
      let ms = sail_plan(ctx,plan);
      jibs(ms[0],lerp2d(...h.sheer[0],...tip,0.1),tip,arg.jibs,arg,ctx.layers);
    },
  },

  // a cutter: one tall mast well aft, a big gaff mainsail with a topsail, and a long bowsprit
  // carrying several headsails
  cutter:{
    params(arg){
      KINDS.schooner.params(arg);
      arg.masts = 1;
      arg.bermuda = 0;
      arg.topsail = choice([0,1],[1,3]);
      arg.rig_height = rndtri(0.7,0.85,1);
      arg.jibs = choice([2,3],[2,1]);
      arg.bowsprit = rndtri(0.25,0.32,0.4);
      arg.bowsprit_angle = rndtri(0.02,0.08,0.15);
      arg.bow_rake = rndtri(0,0.3,0.7);
      arg.transom = choice([0,1],[2,1]);
    },
    build(ctx){
      let {h,L,arg} = ctx;
      ctx.dark = k=>(k < 0.2 ? 0.45 : 1);
      ctx.rail = 0.08;
      let tip = bowsprit(ctx,arg.bowsprit*L,arg.bowsprit_angle);
      let ms = sail_plan(ctx,[{t:0.45,h:1,kind:'gaff',boom:1.05}]);
      jibs(ms[0],lerp2d(...h.sheer[0],...tip,0.05),tip,arg.jibs,arg,ctx.layers);
    },
  },

  // felucca or dhow: lateen sails on masts raked forward, a low hull with a long overhanging
  // bow and a raised stern
  lateen:{
    params(arg){
      arg.hull_length = rndtri(200,240,280);
      arg.freeboard = arg.hull_length*rndtri(0.06,0.07,0.08);
      arg.masts = choice([1,2],[3,2]);
      arg.sheer = rndtri(0.8,1.2,1.6);
      arg.bow_rise = rndtri(0.6,0.9,1.2);
      arg.stern_rise = rndtri(0.6,1,1.4);
      arg.bow_rake = rndtri(2,2.8,3.6);
      arg.bow_curve = rndtri(0.2,0.5,0.8);
      arg.stern_overhang = rndtri(0.2,0.5,0.8);
      arg.transom = 1;
      arg.hull_tone = rndtri(0.3,0.5,0.7);
      arg.rig_height = rndtri(0.45,0.55,0.65);
      arg.rake = -rndtri(0.08,0.15,0.25);
      arg.lateen_len = rndtri(0.75,0.9,1.05);
      arg.lateen_angle = rndtri(0.38,0.5,0.62);
      arg.pennant = rndtri(1.5,2.5,3.5);
    },
    build(ctx){
      let {arg} = ctx;
      ctx.dark = k=>(k < 0.08 ? 0 : 1);
      ctx.rail = 0;
      ctx.ensign = false;
      let plan = arg.masts == 2
        ? [{t:0.3,h:1,kind:'lateen'},{t:0.66,h:0.7,kind:'lateen'}]
        : [{t:0.38,h:1,kind:'lateen'}];
      sail_plan(ctx,plan);
    },
  },

  // a junk: battened sails on unstayed masts, a high square stern, a flat raked bow and an eye
  junk:{
    params(arg){
      arg.hull_length = rndtri(220,260,300);
      arg.freeboard = arg.hull_length*rndtri(0.07,0.08,0.09);
      arg.masts = choice([2,3],[2,3]);
      arg.sheer = rndtri(1,1.4,1.8);
      arg.sheer_pow = rndtri(1.8,2.2,2.6);
      arg.bow_rise = rndtri(0.5,0.7,0.9);
      arg.stern_rise = rndtri(1.3,1.7,2.1);
      arg.bow_rake = rndtri(1.6,2,2.4);
      arg.bow_curve = rndtri(-0.2,0,0.2);
      arg.stern_overhang = rndtri(0.8,1.1,1.4);
      arg.transom = 1;
      arg.hull_tone = rndtri(0.5,0.65,0.8);
      arg.rig_height = rndtri(0.6,0.7,0.8);
      arg.rake = rndtri(-0.06,0,0.06);
      arg.battens = choice([5,6,7]);
      arg.pennant = rndtri(1.5,2.5,3.5);
    },
    build(ctx){
      let {h,F,arg} = ctx;
      ctx.dark = k=>(Math.abs(k-0.1) < 0.025 ? 0 : 1);
      ctx.rail = 0.1;
      ctx.ensign = false;
      ctx.front.push(bow_eye(h));
      ctx.behind.push(castle(h,0.82,1,0,F*0.9,arg.hull_tone));
      let plan = arg.masts == 3
        ? [{t:0.12,h:0.7,kind:'junk',rake:-0.15},{t:0.42,h:1,kind:'junk'},{t:0.72,h:0.75,kind:'junk'}]
        : [{t:0.25,h:0.85,kind:'junk',rake:-0.08},{t:0.6,h:1,kind:'junk'}];
      sail_plan(ctx,plan);
    },
  },

  // a longship: curling stem and stern posts, shields along the side, oars, one striped sail
  longship:{
    params(arg){
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
    },
    build(ctx){
      let {h,L,F,arg,layers} = ctx;
      ctx.ensign = false;
      let tan = (a,b)=>Math.atan2(a[1]-b[1],a[0]-b[0]);
      let bp = curl_post(h.sheer[0],tan(h.bow[0],h.bow[3]),F*arg.post_len,arg.post_curl,F*0.42);
      let sp = curl_post(h.sheer[h.sheer.length-1],tan(h.stern[0],h.stern[3]),F*arg.post_len*0.9,-arg.post_curl,F*0.42);
      ctx.hull_extra.push(bp,sp);
      let r = F*0.6;
      let sh = {lines:[],occ:[]};
      let k = 0;
      for (let t = 0.2; t <= 0.8; t += r*1.7/L, k++){
        let [x,y] = h.deck(t);
        let s = shield([x,y+r*0.45],r,k);
        sh.lines.push(...clip_out(s.lines,sh.occ));
        sh.occ.push(...s.occ);
      }
      ctx.front.push(sh);
      if (arg.oars) ctx.front.unshift(oar_bank(h,0.22,0.78,r*3.4/L,r*1.3,F*4,arg.oar_angle,r*0.85));
      let so = h.deck(0.88);
      ctx.hull_extra.push(spar([so[0]-F*0.2,so[1]-F*0.4],[so[0]+F*0.9,YW+F*1.5],1.6));
      single_square(ctx,0.5,arg.rig_height*L,L*0.22*arg.sail_width,arg.stripes);
      layers.stays.push([layers.masts[layers.masts.length-1].head,bp.path[~~(bp.path.length*0.25)]],[layers.masts[layers.masts.length-1].head,sp.path[~~(sp.path.length*0.25)]]);
    },
  },

  // a galley: a long low hull with a ram, two banks of oars, one square sail and a curling stern
  galley:{
    params(arg){
      arg.hull_length = rndtri(280,320,360);
      arg.freeboard = arg.hull_length*rndtri(0.065,0.075,0.085);
      arg.sheer = rndtri(1,1.5,2);
      arg.sheer_pow = rndtri(2.6,3.2,3.8);
      arg.bow_rise = rndtri(0.4,0.6,0.8);
      arg.stern_rise = rndtri(1,1.3,1.6);
      arg.bow_rake = rndtri(-0.4,0,0.4);
      arg.bow_curve = rndtri(-0.3,0,0.3);
      arg.stern_overhang = rndtri(1.4,2,2.6);
      arg.transom = 0;
      arg.hull_tone = rndtri(0.5,0.65,0.8);
      arg.post_len = rndtri(4,5,6.5);
      arg.post_curl = rndtri(2.6,3.2,3.8);
      arg.oar_angle = rndtri(0.85,1,1.15);
      arg.rig_height = rndtri(0.32,0.38,0.44);
      arg.sail_width = rndtri(0.7,0.85,1);
      arg.stripes = choice([0,0,6,8]);
      arg.furl = choice([0,1],[3,1]);
    },
    build(ctx){
      let {h,L,F,arg,layers} = ctx;
      ctx.ensign = false;
      ctx.dark = k=>((Math.abs(k-0.08) < 0.03 || Math.abs(k-0.17) < 0.03) ? 0 : 1);
      ctx.front.push(bow_eye(h));
      // the ram: a bronze spur at the waterline, ahead of the stem
      let b = h.bow[~~(h.bow.length*0.6)];
      let ram = [[b[0]+F*0.3,YW-F*0.35],[b[0]-F*1.6,YW-F*0.02],[b[0]+F*0.3,YW+F*0.4]];
      ctx.hull_extra.push({lines:[ram.concat([ram[0]]),[[b[0]-F*1.2,YW-F*0.08],[b[0]+F*0.3,YW-F*0.15]],...fill_shape(ram,2)],occ:[ram]});
      let sp = curl_post(h.sheer[h.sheer.length-1],-PI/2+0.7,F*arg.post_len,-arg.post_curl,F*0.32);
      ctx.hull_extra.push(sp);
      let step = F*0.75/L;
      ctx.front.unshift(oar_bank(h,0.16,0.84,step,F*0.22,F*4.2,arg.oar_angle,0));
      ctx.front.unshift(oar_bank(h,0.17,0.85,step,F*0.48,F*3.6,arg.oar_angle-0.08,0));
      single_square(ctx,0.45,arg.rig_height*L,L*0.18*arg.sail_width,arg.stripes,arg.furl);
      let m = layers.masts[layers.masts.length-1];
      layers.stays.push([m.head,h.sheer[0]],[m.head,h.sheer[h.sheer.length-1]]);
    },
  },

  // a steamer: stacked decks, funnels and smoke, lifeboats, two pole masts
  steamer:{
    params(arg){
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
    },
    build(ctx){
      let {h,F,arg,layers} = ctx;
      ctx.dark = k=>(k < 0.07 ? 0 : 1);
      ctx.holes.push(portholes(h,0.15,F*0.055,0.1,0.9,0.022));
      if (arg.decks > 1) ctx.holes.push(portholes(h,0.04,F*0.05,0.25,0.78,0.022));
      ctx.rail = 0.12;
      let tiers = deck_tiers(ctx,arg.super_from,arg.super_to,arg.decks,arg.super_step,arg.deck_height);
      let tt = tiers[tiers.length-1];
      let bw = F*1.3;
      let bridge = deckhouse(tt.x0,tt.x0+bw,tt.y0-F*0.7,tt.y0+1,F,{pitch:0.22,win:0.12,ht:0.7,rail:false});
      ctx.behind.unshift(bridge);
      let bd = tiers[Math.min(1,tiers.length-1)];
      ctx.behind.unshift(davit_boats(bd.x0+F*1.6,bd.x1-F*1.4,bd.y0,F));
      let fx0 = tt.x0+bw+F*0.6;
      let fx1 = tt.x1-F*0.6;
      for (let i = 0; i < arg.funnels; i++){
        let x = arg.funnels == 1 ? (fx0+fx1)/2 : lerp(fx0,fx1,i/(arg.funnels-1));
        add_funnel(ctx,[x,tt.y0+F*0.3],F*arg.funnel_w,F*arg.funnel_h,arg.funnel_rake,arg.funnel_band,arg.smoke,i);
      }
      let fm = pole_mast(ctx,0.08,F*arg.mast_h,arg.rake);
      let mm = pole_mast(ctx,0.9,F*arg.mast_h*0.95,arg.rake);
      layers.stays.push([h.sheer[0],fm.head],[fm.head,mm.head],[mm.head,h.sheer[h.sheer.length-1]]);
      layers.flags.push(flag(fm.head,F*0.9,F*0.12,true,arg.sea_z));
    },
  },

  // a tug: a short deep hull with a high bow, a wheelhouse, one big funnel, fenders all round
  tug:{
    params(arg){
      arg.hull_length = rndtri(170,200,230);
      arg.freeboard = arg.hull_length*rndtri(0.11,0.125,0.14);
      arg.sheer = rndtri(0.5,0.8,1.1);
      arg.bow_rise = rndtri(0.8,1,1.2);
      arg.stern_rise = rndtri(0,0.15,0.3);
      arg.bow_rake = rndtri(0,0.25,0.5);
      arg.bow_curve = rndtri(0,0.1,0.2);
      arg.stern_overhang = rndtri(0.3,0.5,0.7);
      arg.transom = 0;
      arg.hull_tone = rndtri(0.6,0.75,0.9);
      arg.funnel_w = rndtri(0.75,0.9,1.05);
      arg.funnel_h = rndtri(1.7,2.1,2.5);
      arg.funnel_rake = rndtri(0,0.06,0.12);
      arg.funnel_band = choice([0,1]);
      arg.smoke = choice([0,4,6],[1,2,2]);
      arg.mast_h = rndtri(2.2,2.8,3.4);
    },
    build(ctx){
      let {h,F,arg,layers} = ctx;
      ctx.dark = k=>(k < 0.05 ? 0 : 1);
      ctx.holes.push(portholes(h,0.12,F*0.06,0.15,0.6,0.07));
      ctx.rail = 0.1;
      ctx.front.push(fenders(h,0.12,0.88,0.09));
      // a thick rope fender over the stem
      let bf = h.bow.slice(0,~~(h.bow.length*0.4));
      let [l,r] = tube(resample(bf,1.5),u=>F*0.12);
      ctx.front.push({lines:[l,r,...l.filter((p,i)=>i%3 == 0).map((p,i)=>[p,r[i*3]])],occ:[l.concat(r.slice().reverse())]});
      let [x0,y0] = h.deck(0.3);
      let x1 = h.deck(0.68)[0];
      let house = deckhouse(x0,x1,y0-F*0.75,y0+F*0.4,F,{round:true,pitch:0.3});
      let wx = x0+F*0.2;
      let wheel = deckhouse(wx,wx+F*1.5,y0-F*1.7,y0-F*0.74,F,{win:0.22,pitch:0.34,ht:0.9});
      ctx.behind.push(wheel,house);
      add_funnel(ctx,[wx+F*2.4,y0-F*0.6],F*arg.funnel_w,F*arg.funnel_h,arg.funnel_rake,arg.funnel_band,arg.smoke,0);
      // the towing hook aft
      let [tx,ty] = h.deck(0.84);
      layers.rig.push(bezier3([tx-F*0.4,ty],[tx-F*0.4,ty-F*0.6],[tx+F*0.4,ty-F*0.6],[tx+F*0.4,ty],10),[[tx,ty-F*0.45],[tx+F*0.15,ty-F*0.2]]);
      let fm = pole_mast(ctx,0.22,F*arg.mast_h,arg.rake);
      layers.stays.push([h.sheer[0],fm.head],[fm.head,h.deck(0.5)]);
    },
  },

  // a steam yacht: a slim dark hull with a clipper bow and bowsprit, one raked funnel and two
  // raked masts with small sails
  yacht:{
    params(arg){
      arg.hull_length = rndtri(260,300,340);
      arg.freeboard = arg.hull_length*rndtri(0.055,0.065,0.075);
      arg.sheer = rndtri(0.4,0.6,0.8);
      arg.bow_rise = rndtri(0.7,0.9,1.1);
      arg.stern_rise = rndtri(0.2,0.35,0.5);
      arg.bow_rake = rndtri(1.6,2.2,2.8);
      arg.bow_curve = rndtri(0.4,0.6,0.8);
      arg.stern_overhang = rndtri(1,1.4,1.8);
      arg.transom = 0;
      arg.hull_tone = rndtri(0.8,0.9,1);
      arg.rake = rndtri(0.1,0.15,0.2);
      arg.rig_height = rndtri(0.32,0.38,0.44);
      arg.gaff_angle = rndtri(0.5,0.6,0.7);
      arg.topsail = 0;
      arg.funnel_w = rndtri(0.5,0.6,0.7);
      arg.funnel_h = rndtri(1.4,1.8,2.2);
      arg.funnel_rake = rndtri(0.12,0.18,0.24);
      arg.smoke = choice([0,4],[2,1]);
      arg.bowsprit = rndtri(0.08,0.11,0.14);
      arg.bowsprit_angle = rndtri(0.15,0.22,0.3);
      arg.jibs = 1;
      arg.sails_set = choice([0,1]);
    },
    build(ctx){
      let {h,L,F,arg,layers} = ctx;
      ctx.dark = k=>(k < 0.05 ? 0 : Math.abs(k-0.09) < 0.012 ? 0 : 1);
      ctx.holes.push(portholes(h,0.15,F*0.06,0.2,0.75,0.05));
      ctx.rail = 0.1;
      let tip = bowsprit(ctx,arg.bowsprit*L,arg.bowsprit_angle);
      let [x0,y0] = h.deck(0.3);
      let x1 = h.deck(0.74)[0];
      ctx.behind.push(deckhouse(x0,x1,y0-F*0.6,y0+F*0.4,F,{pitch:0.3}));
      ctx.behind.unshift(davit_boats(x0+F*1.2,x1-F*1.8,y0-F*0.6,F));
      add_funnel(ctx,[(x0+x1)/2,y0-F*0.4],F*arg.funnel_w,F*arg.funnel_h,arg.funnel_rake,1,arg.smoke,0);
      if (arg.sails_set){
        let ms = sail_plan(ctx,[{t:0.2,h:1,kind:'gaff',boom:0.55},{t:0.82,h:0.92,kind:'gaff',boom:1}]);
        jibs(ms[0],lerp2d(...h.sheer[0],...tip,0.1),tip,1,arg,layers);
      }else{
        for (let [t,hh] of [[0.2,1],[0.82,0.92]]){
          let m = make_mast(h.deck(t),arg.rig_height*L*hh,arg.rake,F*0.1);
          layers.masts.push({lines:m.lines,occ:[m.poly],head:m.head});
          let tack = m.at(0.12);
          layers.sails.push(furled(tack,[tack[0]+F*3,tack[1]-F*0.2]));
          layers.rig.push(...shrouds(h,m,0.7,3,F*0.5));
        }
        layers.stays.push([layers.masts[0].head,tip],[layers.masts[0].head,layers.masts[1].head]);
      }
    },
  },

  // a paddle steamer: a big paddle box amidships, tall thin funnels and a walking beam
  paddle:{
    params(arg){
      arg.hull_length = rndtri(280,320,360);
      arg.freeboard = arg.hull_length*rndtri(0.06,0.07,0.08);
      arg.sheer = rndtri(0.3,0.5,0.7);
      arg.bow_rise = rndtri(0.5,0.7,0.9);
      arg.stern_rise = rndtri(0.2,0.4,0.6);
      arg.bow_rake = rndtri(0.2,0.6,1);
      arg.bow_curve = rndtri(0,0.2,0.4);
      arg.stern_overhang = rndtri(0.5,0.8,1.1);
      arg.transom = 0;
      arg.hull_tone = rndtri(0.55,0.7,0.85);
      arg.funnels = choice([1,2],[2,1]);
      arg.funnel_w = rndtri(0.45,0.55,0.65);
      arg.funnel_h = rndtri(3,3.6,4.2);
      arg.funnel_rake = rndtri(0,0.04,0.1);
      arg.smoke = choice([0,4,6,8],[1,2,2,1]);
      arg.beam = choice([0,1]);
      arg.box = rndtri(1.6,1.9,2.2);
      arg.mast_h = rndtri(3,3.6,4.2);
    },
    build(ctx){
      let {h,F,arg,layers} = ctx;
      ctx.dark = k=>(k < 0.05 ? 0 : 1);
      ctx.rail = 0.12;
      let [px,py] = h.deck(0.48);
      ctx.front.push(paddle_box([px,py+F*0.1],F*arg.box,F));
      let [x0,y0] = h.deck(0.24);
      let x1 = h.deck(0.8)[0];
      ctx.behind.push(deckhouse(x0,x1,y0-F*0.7,y0+F*0.4,F,{pitch:0.26}));
      let fxs = arg.funnels == 2 ? [px-F*1.6,px+F*1.6] : [px-F*(arg.beam ? 2 : 0)];
      fxs.forEach((x,i)=>add_funnel(ctx,[x,y0-F*0.5],F*arg.funnel_w,F*arg.funnel_h,arg.funnel_rake,0,arg.smoke,i));
      if (arg.beam){
        // the walking beam on its A-frame, rocking above the deck
        let apex = [px+F*(arg.funnels == 2 ? 0 : 0.6),y0-F*2.4];
        let a = [apex[0]-F*2,apex[1]+F*0.3];
        let b = [apex[0]+F*2,apex[1]-F*0.3];
        let beam = [a,[apex[0],apex[1]-F*0.16],b,[apex[0],apex[1]+F*0.16],a];
        let pivot = ellipse(...apex,F*0.1,F*0.1,0,10);
        let frame = [[apex[0]-F*0.7,y0-F*0.7],apex,[apex[0]+F*0.7,y0-F*0.7]];
        ctx.behind.unshift({lines:[beam,pivot,...clip_out([frame,[a,[a[0],y0-F*0.7]]],[beam.slice(0,4)])],occ:[beam.slice(0,4)]});
      }
      let fm = pole_mast(ctx,0.1,F*arg.mast_h,arg.rake);
      layers.stays.push([h.sheer[0],fm.head],[fm.head,h.deck(0.4)]);
      layers.flags.push(flag(fm.head,F*1.2,F*0.14,true,arg.sea_z));
    },
  },

  // an ironclad: a low black armoured hull with a ram bow, a turret or a casemate, a short
  // funnel and a pole mast
  ironclad:{
    params(arg){
      arg.hull_length = rndtri(260,300,340);
      arg.freeboard = arg.hull_length*rndtri(0.04,0.048,0.056);
      arg.sheer = rndtri(0,0.15,0.3);
      arg.bow_rise = rndtri(0.2,0.5,0.8);
      arg.stern_rise = rndtri(0.2,0.4,0.6);
      arg.bow_rake = -rndtri(0.8,1.2,1.6);
      arg.bow_curve = -rndtri(0.2,0.4,0.6);
      arg.stern_overhang = rndtri(0.2,0.5,0.8);
      arg.transom = 0;
      arg.hull_tone = rndtri(0.85,0.92,1);
      arg.casemate = choice([0,1]);
      arg.turrets = choice([1,2],[2,3]);
      arg.funnel_w = rndtri(0.8,1,1.2);
      arg.funnel_h = rndtri(1.4,1.8,2.2);
      arg.funnel_rake = rndtri(0,0.05,0.1);
      arg.smoke = choice([0,4,6],[1,2,2]);
      arg.mast_h = rndtri(3,3.8,4.6);
    },
    build(ctx){
      let {h,F,arg,layers} = ctx;
      ctx.dark = k=>1;
      ctx.rail = 0;
      let deck = t=>h.deck(t)[1];
      if (arg.casemate){
        let x0 = h.deck(0.3)[0];
        let x1 = h.deck(0.72)[0];
        ctx.behind.push(casemate(x0,x1,deck(0.5)+2,F*1.3,F));
        add_funnel(ctx,[(x0+x1)/2,deck(0.5)-F*1],F*arg.funnel_w,F*arg.funnel_h,arg.funnel_rake,0,arg.smoke,0);
      }else{
        let ts = arg.turrets == 2 ? [0.28,0.72] : [0.38];
        for (let t of ts){
          let [x,y] = h.deck(t);
          ctx.behind.push(turret([x,y+1],F*3.2,F*1.7,F,t < 0.5 ? -1 : 1));
        }
        let fx = h.deck(arg.turrets == 2 ? 0.5 : 0.62)[0];
        ctx.behind.push(deckhouse(fx-F*1.2,fx+F*1.2,deck(0.5)-F*0.5,deck(0.5)+2,F,{windows:false}));
        add_funnel(ctx,[fx,deck(0.5)-F*0.4],F*arg.funnel_w,F*arg.funnel_h,arg.funnel_rake,0,arg.smoke,0);
      }
      let m = pole_mast(ctx,arg.casemate ? 0.2 : 0.5,F*arg.mast_h,0);
      layers.stays.push([h.sheer[0],m.head],[m.head,h.sheer[h.sheer.length-1]]);
      layers.flags.push(flag(m.head,F*1.4,F*0.16,true,arg.sea_z));
    },
  },
};

// shared pieces of the steam ships

// stacked decks of a superstructure from t0 to t1, each one shorter than the one below
function deck_tiers(ctx,a,b,n,step,dh){
  let {h,F} = ctx;
  let top = Math.min(...[a,b,(a+b)/2].map(t=>h.ysh(t)));
  let tiers = [];
  for (let i = 0; i < n; i++){
    let ta = a+i*step;
    let tb = b-i*step*0.6;
    let x0 = lerp(h.xb,h.xs,ta);
    let x1 = lerp(h.xb,h.xs,tb);
    let y1 = i == 0 ? h.ysh((ta+tb)/2)+F*0.4 : tiers[i-1].y0+1;
    let y0 = (i == 0 ? top : tiers[i-1].y0)-F*dh;
    let d = deckhouse(x0,x1,y0,y1,F,{ht:dh});
    tiers.push({x0,x1,y0,y1,d});
  }
  for (let i = tiers.length-1; i >= 0; i--) ctx.behind.push(tiers[i].d);
  return tiers;
}

// lifeboats in davits along a deck from x0 to x1
function davit_boats(x0,x1,y,F){
  let boats = {lines:[],occ:[]};
  for (let x = x0; x < x1; x += F*1.5){
    let bt = boat(x,y-F*0.42,F*1.05,F*0.24);
    boats.lines.push(...clip_out(bt.lines,boats.occ));
    boats.occ.push(...bt.occ);
    boats.lines.push(bezier3([x+F*0.1,y],[x+F*0.1,y-F*0.7],[x+F*0.3,y-F*0.7],[x+F*0.3,y-F*0.5],8));
    boats.lines.push(bezier3([x+F*0.95,y],[x+F*0.95,y-F*0.7],[x+F*0.75,y-F*0.7],[x+F*0.75,y-F*0.5],8));
  }
  return boats;
}

// a funnel with its smoke
function add_funnel(ctx,base,w,ht,rake,bands,smoke_n,i){
  let f = funnel(base,w,ht,rake,bands);
  ctx.behind.push(f);
  if (smoke_n) ctx.layers.flags.push(smoke(f.top,w*0.45,smoke_n,ctx.arg.sea_z+i));
}

// a bank of oars from ports along the hull, reaching down into the water
function oar_bank(h,t0,t1,step,depth,len,ang,dx){
  let oars = {lines:[],occ:[]};
  for (let t = t0; t <= t1; t += step){
    let [x,y] = h.deck(t);
    let p = [x+dx,y+depth];
    let q = [p[0]-Math.sin(ang)*len,p[1]+Math.cos(ang)*len];
    oars.lines.push(...spar(p,q,0.8).lines,ellipse(...p,1.2,1.2,0,8));
  }
  return oars;
}

// one square sail on a single mast amidships (longships, galleys), perhaps furled
function single_square(ctx,t,ht,half,stripes,furl){
  let {h,F,arg,layers} = ctx;
  let m = make_mast(h.deck(t),ht,arg.rake,F*0.15);
  let c = m.at(0.8);
  let a = [c[0]-half,c[1]];
  let b = [c[0]+half,c[1]];
  layers.spars.push(spar(a,b,1.2));
  if (furl){
    layers.sails.push(furled(a,b));
  }else{
    let fc = m.at(0.12);
    let BL = [fc[0]-half*1.05,fc[1]];
    let BR = [fc[0]+half*1.05,fc[1]];
    let hgt = dist(...a,...BL);
    layers.sails.push(make_sail(a,b,BL,BR,{bulgeL:hgt*0.06,bulgeR:hgt*0.06,belly:hgt*0.08,shade:arg.sail_shade,stripes,seam:9}));
  }
  layers.masts.push({lines:m.lines,occ:[m.poly],head:m.head});
  layers.flags.push(flag(m.head,F*1.6,F*0.3,true,arg.sea_z));
  return m;
}

function ship(arg){
  let h = hull_shape(arg);
  let L = h.L;
  let F = h.F;
  let ctx = {
    h,L,F,arg,
    layers:{sails:[],spars:[],rig:[],stays:[],masts:[],flags:[]},
    hull_extra:[],
    behind:[],
    front:[],
    holes:[],
    dark:k=>1,
    rail:0,
    ensign:true,
    tip:null,
  };
  KINDS[arg.kind].build(ctx);
  let layers = ctx.layers;

  // the hull: engraved tone, then ports and windows cut into it
  let planks = hull_lines(h,lerp(4.5,1.7,arg.hull_tone),ctx.dark,arg.sea_z+7);
  let deco = [];
  for (let ho of ctx.holes){
    planks = clip_out(planks,ho.occ);
    deco.push(...ho.lines);
  }
  let hull = {lines:[h.sheer,h.stern,h.bow,...planks,...deco],occ:[h.outline]};
  if (ctx.rail) hull.lines.push(...deck_rail(h,0.03,0.97,F*ctx.rail));

  // the ensign on a staff at the stern
  if (ctx.ensign){
    let st = h.sheer[h.sheer.length-1];
    let staff_top = [st[0]+F*0.5,st[1]-F*1.5];
    layers.rig.push([st,staff_top]);
    layers.flags.push(flag(staff_top,F*0.9,F*0.55,false,arg.sea_z+2));
  }

  // rigging that ends on the deck edge is lifted a hair above it, so the hull does not swallow it
  let lift = p=>{
    let t = h.tx(p[0]);
    let y = h.ysh(t);
    return (t > -0.05 && t < 1.05 && Math.abs(p[1]-y) < 0.8) ? [p[0],y-0.8] : p;
  };
  layers.rig = layers.rig.map(l=>l.map(lift));
  layers.stays = layers.stays.map(l=>l.map(lift));

  // the sea, sized to the whole ship
  let pts = [h.outline,...ctx.hull_extra.map(e=>e.occ).flat(),...layers.sails.map(s=>s.occ).flat(),...layers.stays,...ctx.behind.map(e=>e.occ).flat()].flat();
  let xa = Math.min(...pts.map(p=>p[0]))-L*0.12;
  let xb = Math.max(...pts.map(p=>p[0]))+L*0.12;
  let ytop = Math.min(...pts.map(p=>p[1]));
  let s = sea(h,xa,xb,arg);

  let birds = {lines:gulls(xa,xb,ytop-L*0.02,ytop+L*0.12,arg.gulls),occ:[]};

  return compose([
    ...s.fronts,
    s.layer,
    ...ctx.front,
    hull,
    ...ctx.hull_extra,
    {lines:layers.rig,occ:[]},
    ...ctx.behind,
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
    kind:'ship',
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
    lateen_len:0.9,
    lateen_angle:0.5,
    battens:6,
    castle:1,
    decks:2,
    deck_height:0.9,
    super_from:0.28,
    super_to:0.78,
    super_step:0.05,
    funnels:2,
    funnel_w:0.9,
    funnel_h:2.8,
    funnel_rake:0.1,
    funnel_band:1,
    smoke:6,
    mast_h:3.4,
    post_len:9,
    post_curl:4.5,
    oars:1,
    oar_angle:0.7,
    sail_width:1,
    stripes:8,
    casemate:0,
    turrets:1,
    beam:0,
    box:1.9,
    sails_set:1,
    chop:0.3,
    speed:0.6,
    sea_z:0,
    gulls:2,
  };
}

// how often each kind turns up, and which kinds a name's prefix allows
const KIND_WEIGHTS = {ship:3,brig:2,clipper:2,galleon:1.5,schooner:3,cutter:1.5,lateen:1.5,junk:1.5,longship:1.2,galley:1.2,steamer:2,tug:1,yacht:1,paddle:1,ironclad:0.8};
const PREFIX_KINDS = {
  SS:{steamer:4,tug:1.5,yacht:0.5},
  MV:{steamer:4,tug:1.5},
  RMS:{steamer:1},
  PS:{paddle:1},
  SY:{yacht:1},
  HMS:{ship:3,galleon:1.5,ironclad:1.5},
  USS:{ironclad:2,ship:1,steamer:1},
  SMS:{ironclad:2,steamer:1},
};

// the name decides some of the ship: SS and MV are steamers or tugs, PS a paddle steamer,
// SY a steam yacht, HMS and USS warships
function generate_params(name){
  let arg = default_params();
  let prefix = (name || '').trim().split(/\s+/)[0].toUpperCase();
  let pool = PREFIX_KINDS[prefix] || KIND_WEIGHTS;
  let kinds = Object.keys(pool);
  arg.kind = choice(kinds,kinds.map(k=>pool[k]));
  arg.warship = PREFIX_KINDS[prefix] && ['HMS','USS'].includes(prefix) && arg.kind == 'ship' ? 1 : 0;
  arg.sea_z = rand()*100;
  arg.chop = rndtri(0.1,0.3,0.6);
  arg.speed = rndtri(0,0.6,1);
  arg.gulls = choice([0,1,2,3],[3,2,2,1]);
  arg.sail_shade = rndtri(0.2,0.5,0.8);
  arg.rake = rndtri(0,0.05,0.12);
  KINDS[arg.kind].params(arg);
  return arg;
}


// ---------------------------------------------------------------- names

const SHIP_ADJ = ['Northern','Southern','Western','Silver','Golden','Swift','Bold','Fair','Gallant','Noble','Royal','Iron','Lucky','Restless','Crimson','Morning','Evening','Wandering','Brave','Merry','Stormy','Quiet','Faithful','Grey','Black','White','Flying','Rising','Lonely','Hopeful'];
const SHIP_NOUN = ['Star','Gull','Wind','Tide','Albatross','Heron','Petrel','Mariner','Venture','Spirit','Fortune','Promise','Rover','Pilgrim','Dawn','Horizon','Comet','Swallow','Osprey','Cormorant','Dolphin','Narwhal','Kraken','Current','Lantern','Compass','Anchor','Harbour','Seal','Whale'];
const SHIP_ONE = ['Endeavour','Resolute','Intrepid','Dauntless','Valiant','Victory','Discovery','Adventure','Terror','Erebus','Beagle','Bounty','Calypso','Fram','Mayflower','Nautilus','Argo','Endurance','Aurora','Hesperus','Ariadne','Ophelia','Persephone','Cassiopeia','Orion','Triton','Neptune','Mercury','Juno','Minerva','Clementine','Matilda','Isabella','Henrietta','Perseverance','Constance','Serenity','Tenacity','Vigilant','Undaunted'];
const SHIP_TITLE = ['Lady','Queen','Princess','Duchess','Countess'];
const SHIP_GIVEN = ['Margaret','Elizabeth','Charlotte','Eleanor','Catherine','Mary','Anne','Victoria','Louisa','Harriet','Sophia','Adelaide'];
const SHIP_PREFIX = ['HMS','SS','RMS','MV','PS','SY','USS','The',''];

function ship_name(){
  let prefix = choice(SHIP_PREFIX,[3,3,1.5,1,1,1,1,2,6]);
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
