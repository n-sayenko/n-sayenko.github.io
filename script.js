//should clean this
const imgSrc = "nataliya2.jpg";
const c = document.getElementById("world");
const ctx = c.getContext("2d");
const w = (c.width = 220);
const h = (c.height = 220);

const bounds = c.getBoundingClientRect();
let mx = -1000;
let my = -1000;

// PARTICLE VARS
var strength = 450;
var blackAndWhite = true;
const particle = {
  x: 0,
  y: 0,
  ox: 0,
  oy: 0,
  r: 255,
  g: 255,
  b: 255
};


let animate = null;

var list = [];

Number.prototype.map = function(in_min, in_max, out_min, out_max) {
  return ((this - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
};

c.addEventListener("mouseout", function(e) {
  mx = -300;
  my = -300;
});

c.addEventListener("mousemove", function(e) {
  console.log(e)
  mx = e.offsetX ;
  my = e.offsetY;
  mx = mx.map(0, c.offsetWidth, 0, w);
  my = my.map(0, c.offsetHeight, 0, h);



});

c.addEventListener("touchmove", function(e) {
  mx = e.targetTouches[0].pageX - bounds.left;
  my = e.targetTouches[0].pageY - bounds.top;
  mx = mx.map(0, c.offsetWidth, 0, w);
  my = my.map(0, c.offsetHeight, 0, h);
});

const start = ()=>{
  let img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = function() {
    ctx.clearRect(0,0,w,h)
    ctx.drawImage(img, 0, 0, w, h);
    pixelate(img);

    if(animate === null){
      step();

    }
  };
  img.src = imgSrc;
}





const getIndex = (y, x, data) => {
  return y * 4 * data.width + x * 4;
};

function calculateQuantError(o, n) {
  const oc = parseInt((o.r + o.g + o.b) / 3),
    nc = parseInt((n.r + n.g + n.b) / 3);
  return { r: oc - nc, g: oc - nc, b: oc - nc, a: 255 };
}

function addError(imageData, factor, x, y, errR, errG, errB) {
  imageData.data[getIndex(y, x, imageData)] =
    imageData.data[getIndex(y, x, imageData)] + errR * factor;
  imageData.data[getIndex(y, x, imageData) + 1] =
    imageData.data[getIndex(y, x, imageData)] + errG * factor;
  imageData.data[getIndex(y, x, imageData) + 2] =
    imageData.data[getIndex(y, x, imageData)] + errB * factor;
}

function distributeError(imageData, x, y, errR, errG, errB) {
  addError(imageData, 7 / 16, x + 1, y, errR, errG, errB);
  addError(imageData, 3 / 16, x - 1, y + 1, errR, errG, errB);
  addError(imageData, 5 / 16, x, y + 1, errR, errG, errB);
  addError(imageData, 1 / 16, x + 1, y + 1, errR, errG, errB);
}

const pixelate = img => {
  const imageData = ctx.getImageData(0, 0, w, h),
    data = imageData.data,
    len = data.length;

  ctx.clearRect(0, 0, w, h);

  if(!blackAndWhite){
  
  for (var y = 0, y2 = imageData.height; y < y2; y++) {
    for (var x = 0, x2 = imageData.width; x < x2; x++) {
      const index = getIndex(y, x, imageData);
    
    p = Object.create( particle );
    p.x = p.ox = x;
    p.y = p.oy = y;
    p.r = imageData.data[index];
    p.g = imageData.data[index+1];
    p.b = imageData.data[index+2];
    
    list.push(p);
    
    }
  }
  } else {
    for (var y = 0, y2 = imageData.height - 1; y < y2; y++) {
      for (var x = 1, x2 = imageData.width - 1; x < x2; x++) {
        const index = getIndex(y, x, imageData);
        let r = imageData.data[index];
        let g = imageData.data[index + 1];
        let b = imageData.data[index + 2];

       
  
        const c = parseInt((r + g + b) / 3 > 128 ?255 : 0);
  
        imageData.data[index] = c;
        imageData.data[index + 1] = c;
        imageData.data[index + 2] =  c;

        const oldColor = {
          r: r,
          g: g,
          b: b
        };
        const newColor = {
          r:  c,
          g:  c,
          b: c
        };

        const qe = calculateQuantError(oldColor, newColor);
  
        distributeError(imageData, x, y, qe.r, qe.g, qe.b);
  
        p = Object.create(particle);
        p.x = p.ox = x;
        p.y = p.oy = y;
        p.r = imageData.data[index];
        p.g = imageData.data[index + 1];
        p.b = imageData.data[index + 2];
        list.push(p);
      }
    }

  }

  
  ctx.putImageData(imageData, 0, 0);
};

function step() {
  
  for (i = 0; i < list.length; i++) {
    p = list[i];

    dx = p.x - mx;
    dy = p.y - my;
    angle = Math.atan2(dy, dx);
    dist = strength  / Math.sqrt(dx * dx + dy * dy);
    p.x += Math.cos(angle) * dist;
    p.y += Math.sin(angle) * dist;
    p.x += (p.ox - p.x) * 0.1;
    p.y += (p.oy - p.y) * 0.1;
  }

  if(blackAndWhite){
    b = (a = ctx.createImageData(w, h)).data;
    for (i = 0; i < list.length; i++) {
      p = list[i];
      b[(n = (~~p.x + ~~p.y * w) * 4)];
      b[n] = p.r;
      b[n + 1] = p.g;
      b[n + 2] = p.b;
      b[n + 3] = 255;
    }
    ctx.putImageData(a, 0, 0);

  } else {
    ctx.clearRect(0,0,w,h)
    const newImage = ctx.createImageData( w, h );
    const newimageData = newImage.data;
  
      for ( i = 0; i < list.length; i++ ) {
  
        p = list[i];
        newimageData[n = ( ~~p.x + ( ~~p.y * w ) ) * 4];
        newimageData[n] = p.r; 
        newimageData[n+1] =p.g;
        newimageData[n+2] =p.b;
        newimageData[n+3] =255;
        
      }
  
      ctx.putImageData( newImage, 0, 0 );
  }

  animate = requestAnimationFrame(step);
}

start();


 
