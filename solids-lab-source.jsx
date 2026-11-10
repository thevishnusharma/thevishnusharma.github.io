const { useEffect, useRef, useState } = React;

/* ----------------------------- constants ------------------------------ */

const COLOR_PALETTE = [
  "#F2A541", "#5FA8D3", "#7FBF7F", "#E17A8D",
  "#C792EA", "#4FD1C5", "#F08A5D", "#9FB4CC",
];

const SHAPE_LABELS = {
  cylinder: "Cylinder",
  cone: "Cone",
  frustum: "Frustum",
  hemisphere: "Hemisphere",
  sphere: "Sphere",
  cube: "Cube",
  cuboid: "Cuboid",
};

const SHAPE_TYPES = [
  { type: "cylinder", label: "+ Cylinder" },
  { type: "cone", label: "+ Cone" },
  { type: "frustum", label: "+ Frustum" },
  { type: "hemisphere", label: "+ Hemisphere" },
  { type: "sphere", label: "+ Sphere" },
  { type: "cube", label: "+ Cube" },
  { type: "cuboid", label: "+ Cuboid" },
];

const DEFAULT_PARAMS = {
  cylinder: { radius: 1, height: 2 },
  cone: { radius: 1, height: 2, flipped: false },
  frustum: { radiusBottom: 1, radiusTop: 0.5, height: 2 },
  hemisphere: { radius: 1, flipped: false },
  sphere: { radius: 1 },
  cube: { side: 1.5 },
  cuboid: { length: 2, breadth: 1.5, height: 1 },
};

const PARAM_FIELDS = {
  cylinder: [
    { key: "radius", label: "Radius (r)", min: 0.3, max: 3, step: 0.1 },
    { key: "height", label: "Height (h)", min: 0.3, max: 5, step: 0.1 },
  ],
  cone: [
    { key: "radius", label: "Radius (r)", min: 0.3, max: 3, step: 0.1 },
    { key: "height", label: "Height (h)", min: 0.3, max: 5, step: 0.1 },
  ],
  frustum: [
    { key: "radiusBottom", label: "Bottom radius (r\u2081)", min: 0.3, max: 3, step: 0.1 },
    { key: "radiusTop", label: "Top radius (r\u2082)", min: 0.1, max: 2.9, step: 0.1 },
    { key: "height", label: "Height (h)", min: 0.3, max: 5, step: 0.1 },
  ],
  hemisphere: [
    { key: "radius", label: "Radius (r)", min: 0.3, max: 3, step: 0.1 },
  ],
  sphere: [
    { key: "radius", label: "Radius (r)", min: 0.3, max: 3, step: 0.1 },
  ],
  cube: [
    { key: "side", label: "Side (a)", min: 0.3, max: 3, step: 0.1 },
  ],
  cuboid: [
    { key: "length", label: "Length (l)", min: 0.3, max: 4, step: 0.1 },
    { key: "breadth", label: "Breadth (b)", min: 0.3, max: 4, step: 0.1 },
    { key: "height", label: "Height (h)", min: 0.3, max: 4, step: 0.1 },
  ],
};

const PRESETS = [
  {
    label: "Cone on cylinder",
    build: () => [
      { type: "cylinder", params: { radius: 1, height: 2 } },
      { type: "cone", params: { radius: 1, height: 1.3, flipped: false } },
    ],
  },
  {
    label: "Ice-cream cone",
    build: () => [
      { type: "cone", params: { radius: 1, height: 2.2, flipped: true } },
      { type: "hemisphere", params: { radius: 1, flipped: false } },
    ],
  },
  {
    label: "Capsule",
    build: () => [
      { type: "hemisphere", params: { radius: 0.8, flipped: true } },
      { type: "cylinder", params: { radius: 0.8, height: 2 } },
      { type: "hemisphere", params: { radius: 0.8, flipped: false } },
    ],
  },
  {
    label: "Frustum shade",
    build: () => [
      { type: "frustum", params: { radiusBottom: 1.3, radiusTop: 0.7, height: 1.4 } },
    ],
  },
];

/* --------------------------- geometry helpers -------------------------- */

function computeMetrics(shape) {
  const PI = Math.PI;
  const P = shape.params;
  switch (shape.type) {
    case "cylinder": {
      const r = P.radius, h = P.height;
      return {
        volume: PI * r * r * h,
        csa: 2 * PI * r * h,
        tsa: 2 * PI * r * (h + r),
        heightContribution: h,
        rBottom: r, rTop: r, flatBottom: true, flatTop: true, maxR: r,
      };
    }
    case "cone": {
      const r = P.radius, h = P.height;
      const l = Math.sqrt(r * r + h * h);
      const rBottom = P.flipped ? 0 : r;
      const rTop = P.flipped ? r : 0;
      return {
        volume: (1 / 3) * PI * r * r * h,
        csa: PI * r * l,
        tsa: PI * r * (l + r),
        heightContribution: h,
        rBottom, rTop,
        flatBottom: !P.flipped, flatTop: P.flipped,
        maxR: r, slant: l,
      };
    }
    case "frustum": {
      const r1 = P.radiusBottom, r2 = P.radiusTop, h = P.height;
      const l = Math.sqrt(h * h + (r1 - r2) * (r1 - r2));
      const csa = PI * (r1 + r2) * l;
      return {
        volume: (1 / 3) * PI * h * (r1 * r1 + r2 * r2 + r1 * r2),
        csa,
        tsa: csa + PI * r1 * r1 + PI * r2 * r2,
        heightContribution: h,
        rBottom: r1, rTop: r2, flatBottom: true, flatTop: true,
        maxR: Math.max(r1, r2), slant: l,
      };
    }
    case "hemisphere": {
      const r = P.radius;
      return {
        volume: (2 / 3) * PI * r * r * r,
        csa: 2 * PI * r * r,
        tsa: 3 * PI * r * r,
        heightContribution: r,
        rBottom: P.flipped ? null : r,
        rTop: P.flipped ? r : null,
        flatBottom: !P.flipped, flatTop: P.flipped,
        maxR: r,
      };
    }
    case "sphere": {
      const r = P.radius;
      const tsa = 4 * PI * r * r;
      return {
        volume: (4 / 3) * PI * r * r * r,
        csa: tsa, tsa,
        heightContribution: 2 * r,
        rBottom: null, rTop: null, flatBottom: false, flatTop: false,
        maxR: r,
      };
    }
    case "cube": {
      const a = P.side;
      return {
        volume: a * a * a,
        csa: 4 * a * a,
        tsa: 6 * a * a,
        heightContribution: a,
        rBottom: null, rTop: null, flatBottom: true, flatTop: true,
        isBox: true, footprint: { l: a, b: a },
        maxR: (a * Math.SQRT2) / 2,
      };
    }
    case "cuboid": {
      const l = P.length, b = P.breadth, h = P.height;
      return {
        volume: l * b * h,
        csa: 2 * h * (l + b),
        tsa: 2 * (l * b + b * h + h * l),
        heightContribution: h,
        rBottom: null, rTop: null, flatBottom: true, flatTop: true,
        isBox: true, footprint: { l, b },
        maxR: Math.sqrt((l / 2) ** 2 + (b / 2) ** 2),
      };
    }
    default:
      return { volume: 0, csa: 0, tsa: 0, heightContribution: 0, maxR: 0.5 };
  }
}

function layoutShapes(shapes) {
  const metrics = shapes.map(computeMetrics);
  let y = 0;
  let maxRadius = 0.6;
  const layout = shapes.map((shape, i) => {
    const m = metrics[i];
    const yBottom = y, yTop = y + m.heightContribution;
    y = yTop;
    if (m.maxR > maxRadius) maxRadius = m.maxR;
    return { shape, metrics: m, yBottom, yTop };
  });
  return { layout, totalHeight: y || 1, maxRadius };
}

function computeCombinedStats(shapes) {
  const metrics = shapes.map(computeMetrics);
  const totalVolume = metrics.reduce((s, m) => s + m.volume, 0);
  let totalTSA = metrics.reduce((s, m) => s + m.tsa, 0);
  const joints = [];
  const tol = 0.02;
  for (let i = 0; i < shapes.length - 1; i++) {
    const a = metrics[i], b = metrics[i + 1];
    let hidden = false, area = 0;
    if (a.flatTop && b.flatBottom) {
      if (a.isBox && b.isBox && a.footprint && b.footprint &&
          Math.abs(a.footprint.l - b.footprint.l) < tol &&
          Math.abs(a.footprint.b - b.footprint.b) < tol) {
        area = a.footprint.l * a.footprint.b;
        hidden = true;
      } else if (a.rTop != null && b.rBottom != null && Math.abs(a.rTop - b.rBottom) < tol) {
        area = Math.PI * a.rTop * a.rTop;
        hidden = true;
      }
    }
    if (hidden) totalTSA -= 2 * area;
    joints.push({ index: i, hidden, area });
  }
  return { totalVolume, totalTSA, joints, metrics };
}

function f2(n) { return n.toFixed(2); }

function getFormulaStrings(shape, m) {
  const P = shape.params;
  switch (shape.type) {
    case "cylinder":
      return {
        vol: `V = \u03C0r\u00B2h = \u03C0 \u00D7 ${f2(P.radius)}\u00B2 \u00D7 ${f2(P.height)} = ${f2(m.volume)}`,
        area: `TSA = 2\u03C0r(h + r) = ${f2(m.tsa)}`,
      };
    case "cone":
      return {
        vol: `V = \u2153\u03C0r\u00B2h = \u2153\u03C0 \u00D7 ${f2(P.radius)}\u00B2 \u00D7 ${f2(P.height)} = ${f2(m.volume)}`,
        area: `TSA = \u03C0r(l + r), l = \u221A(r\u00B2+h\u00B2) = ${f2(m.slant)} \u2192 ${f2(m.tsa)}`,
      };
    case "frustum":
      return {
        vol: `V = \u2153\u03C0h(r\u2081\u00B2+r\u2082\u00B2+r\u2081r\u2082) = ${f2(m.volume)}`,
        area: `TSA = \u03C0(r\u2081+r\u2082)l + \u03C0r\u2081\u00B2 + \u03C0r\u2082\u00B2, l = ${f2(m.slant)} \u2192 ${f2(m.tsa)}`,
      };
    case "hemisphere":
      return {
        vol: `V = \u2154\u03C0r\u00B3 = \u2154\u03C0 \u00D7 ${f2(P.radius)}\u00B3 = ${f2(m.volume)}`,
        area: `TSA = 3\u03C0r\u00B2 = ${f2(m.tsa)}`,
      };
    case "sphere":
      return {
        vol: `V = 4/3 \u03C0r\u00B3 = ${f2(m.volume)}`,
        area: `SA = 4\u03C0r\u00B2 = ${f2(m.tsa)}`,
      };
    case "cube":
      return {
        vol: `V = a\u00B3 = ${f2(P.side)}\u00B3 = ${f2(m.volume)}`,
        area: `SA = 6a\u00B2 = ${f2(m.tsa)}`,
      };
    case "cuboid":
      return {
        vol: `V = lbh = ${f2(P.length)}\u00D7${f2(P.breadth)}\u00D7${f2(P.height)} = ${f2(m.volume)}`,
        area: `SA = 2(lb+bh+hl) = ${f2(m.tsa)}`,
      };
    default:
      return { vol: "", area: "" };
  }
}

function getClipPlanes(enabled, orientation, cutPosition, cutAngle, totalHeight) {
  if (!enabled) return [];
  if (orientation === "horizontal") {
    const yWorld = -totalHeight / 2 + cutPosition * totalHeight;
    return [new THREE.Plane(new THREE.Vector3(0, -1, 0), yWorld)];
  }
  const rad = (cutAngle * Math.PI) / 180;
  return [new THREE.Plane(new THREE.Vector3(Math.cos(rad), 0, Math.sin(rad)), 0)];
}

function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

function makeTextSprite(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 40px sans-serif";
  ctx.fillStyle = color || "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.6, 0.3, 1);
  return sprite;
}

function addRadiusIndicator(group, r, y, label) {
  if (r <= 0.001) return;
  const pts = [new THREE.Vector3(0, y, 0), new THREE.Vector3(r, y, 0)];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff }));
  group.add(line);
  const sprite = makeTextSprite(label || "r", "#ffffff");
  sprite.position.set(r + 0.25, y, 0);
  group.add(sprite);
}

function addHeightIndicator(group, yBottom, yTop, xOffset, label) {
  const pts = [new THREE.Vector3(xOffset, yBottom, 0), new THREE.Vector3(xOffset, yTop, 0)];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfde047 }));
  group.add(line);
  const sprite = makeTextSprite(label || "h", "#fde047");
  sprite.position.set(xOffset, (yBottom + yTop) / 2, 0);
  group.add(sprite);
}

function buildShapeGroup(shape, yBottom, yTop, wireframe, clippingPlanes) {
  const g = new THREE.Group();
  const h = yTop - yBottom;
  const midY = (yTop + yBottom) / 2;
  const matOpts = { color: shape.color, side: THREE.DoubleSide, shininess: 22, wireframe, clippingPlanes };
  const P = shape.params;

  if (shape.type === "cylinder") {
    const geo = new THREE.CylinderGeometry(P.radius, P.radius, h, 40);
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial(matOpts));
    mesh.position.y = midY;
    g.add(mesh);
    addRadiusIndicator(g, P.radius, midY);
  } else if (shape.type === "cone") {
    const rTop = P.flipped ? P.radius : 0;
    const rBottom = P.flipped ? 0 : P.radius;
    const geo = new THREE.CylinderGeometry(rTop, rBottom, h, 40);
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial(matOpts));
    mesh.position.y = midY;
    g.add(mesh);
    addRadiusIndicator(g, P.radius, P.flipped ? yTop : yBottom);
  } else if (shape.type === "frustum") {
    const geo = new THREE.CylinderGeometry(P.radiusTop, P.radiusBottom, h, 40);
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial(matOpts));
    mesh.position.y = midY;
    g.add(mesh);
    addRadiusIndicator(g, P.radiusBottom, yBottom, "r\u2081");
    addRadiusIndicator(g, P.radiusTop, yTop, "r\u2082");
  } else if (shape.type === "hemisphere") {
    const r = P.radius;
    const domeGeo = new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMesh = new THREE.Mesh(domeGeo, new THREE.MeshPhongMaterial(matOpts));
    const discGeo = new THREE.CircleGeometry(r, 40);
    const discMesh = new THREE.Mesh(discGeo, new THREE.MeshPhongMaterial(matOpts));
    discMesh.rotation.x = -Math.PI / 2;
    if (!P.flipped) {
      domeMesh.position.y = yBottom;
      discMesh.position.y = yBottom;
    } else {
      domeMesh.position.y = yTop;
      domeMesh.rotation.x = Math.PI;
      discMesh.position.y = yTop;
    }
    g.add(domeMesh);
    g.add(discMesh);
    addRadiusIndicator(g, r, P.flipped ? yTop : yBottom);
  } else if (shape.type === "sphere") {
    const r = P.radius;
    const geo = new THREE.SphereGeometry(r, 40, 40);
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial(matOpts));
    mesh.position.y = yBottom + r;
    g.add(mesh);
    addRadiusIndicator(g, r, yBottom + r);
  } else if (shape.type === "cube") {
    const a = P.side;
    const geo = new THREE.BoxGeometry(a, a, a);
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial(matOpts));
    mesh.position.y = midY;
    g.add(mesh);
  } else if (shape.type === "cuboid") {
    const geo = new THREE.BoxGeometry(P.length, P.height, P.breadth);
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial(matOpts));
    mesh.position.y = midY;
    g.add(mesh);
  }
  return g;
}

/* ------------------------------- styles -------------------------------- */

const sectionLabelStyle = { fontSize: "0.68rem", color: "#8FA9C7", fontWeight: 600, letterSpacing: "0.02em" };
const btnGhostStyle = { fontSize: "0.72rem", padding: "4px 10px", borderRadius: "4px", border: "1px solid #3A5D89", backgroundColor: "transparent", color: "#CBDBEF", cursor: "pointer" };
const btnAddStyle = { fontSize: "0.72rem", padding: "6px 8px", borderRadius: "4px", border: "1px solid #3A5D89", backgroundColor: "#132F58", color: "#E8EEF7", cursor: "pointer", textAlign: "left" };
const btnPresetStyle = { fontSize: "0.72rem", padding: "6px 8px", borderRadius: "4px", border: "1px solid #3A5D89", backgroundColor: "#0E2C52", color: "#F2A541", cursor: "pointer", textAlign: "left" };
const btnToggleStyle = { ...btnGhostStyle, flex: 1, textAlign: "center" };
const btnToggleActive = { ...btnToggleStyle, backgroundColor: "#F2A541", color: "#12233F", border: "1px solid #F2A541", fontWeight: 600 };
const iconBtnStyle = { fontSize: "0.72rem", width: "22px", height: "22px", borderRadius: "4px", border: "1px solid #3A5D89", backgroundColor: "transparent", color: "#CBDBEF", cursor: "pointer", lineHeight: 1 };

/* ------------------------------ sub views ------------------------------ */

function ShapeCard({ index, shape, isFirst, isLast, onChange, onFlip, onRemove, onMoveUp, onMoveDown, onColor }) {
  const fields = PARAM_FIELDS[shape.type];
  const supportsFlip = shape.type === "cone" || shape.type === "hemisphere";
  return (
    <div style={{ border: "1px solid #274870", borderRadius: "6px", padding: "8px", backgroundColor: "#0B2545" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={shape.color}
            onChange={(e) => onColor(e.target.value)}
            title="Change color"
            style={{ width: "16px", height: "16px", padding: 0, border: "none", background: "none", cursor: "pointer" }}
          />
          <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{index + 1}. {SHAPE_LABELS[shape.type]}</span>
        </div>
        <div className="flex items-center gap-1">
          <button disabled={isFirst} onClick={onMoveDown} title="Move down the stack" style={{ ...iconBtnStyle, opacity: isFirst ? 0.3 : 1 }}>&#8595;</button>
          <button disabled={isLast} onClick={onMoveUp} title="Move up the stack" style={{ ...iconBtnStyle, opacity: isLast ? 0.3 : 1 }}>&#8593;</button>
          <button onClick={onRemove} title="Remove" style={iconBtnStyle}>&#10005;</button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 mt-2">
        {fields.map((f) => (
          <div key={f.key}>
            <div style={{ fontSize: "0.68rem", color: "#8FA9C7", display: "flex", justifyContent: "space-between" }}>
              <span>{f.label}</span>
              <span style={{ fontFamily: '"Courier New", monospace' }}>{shape.params[f.key].toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={shape.params[f.key]}
              onChange={(e) => onChange(f.key, parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#F2A541" }}
            />
          </div>
        ))}
        {supportsFlip && (
          <label className="flex items-center gap-2" style={{ fontSize: "0.72rem", color: "#CBDBEF" }}>
            <input type="checkbox" checked={!!shape.params.flipped} onChange={onFlip} />
            Flip orientation
          </label>
        )}
      </div>
    </div>
  );
}

function FormulaPanel({ shapes }) {
  if (shapes.length === 0) {
    return <div style={{ fontSize: "0.78rem", color: "#6E89AC" }}>Add a solid to see its volume and surface area formulas here.</div>;
  }
  const { totalVolume, totalTSA, joints, metrics } = computeCombinedStats(shapes);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        {shapes.map((s, i) => {
          const m = metrics[i];
          const { vol, area } = getFormulaStrings(s, m);
          return (
            <div key={s.id} style={{ fontSize: "0.72rem", lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: s.color }}>{i + 1}. {SHAPE_LABELS[s.type]}</div>
              <div style={{ fontFamily: '"Courier New", monospace', color: "#DCE8F7" }}>{vol}</div>
              <div style={{ fontFamily: '"Courier New", monospace', color: "#DCE8F7" }}>{area}</div>
            </div>
          );
        })}
      </div>
      {shapes.length > 1 && (
        <div style={{ borderTop: "1px dashed #3A5D89", paddingTop: "8px", fontSize: "0.74rem", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700 }}>Combined solid</div>
          <div style={{ fontFamily: '"Courier New", monospace' }}>
            Total volume = {shapes.map((s, i) => `V${i + 1}`).join(" + ")} = {f2(totalVolume)}
          </div>
          <div style={{ fontFamily: '"Courier New", monospace' }}>
            Total surface area = {shapes.map((s, i) => `TSA${i + 1}`).join(" + ")}
            {joints.some((j) => j.hidden) ? " \u2212 " + joints.filter((j) => j.hidden).map((j) => `2\u00D7${f2(j.area)}`).join(" \u2212 ") : ""}
            {" = "}{f2(totalTSA)}
          </div>
          <div style={{ fontSize: "0.68rem", color: "#8FA9C7", marginTop: "4px" }}>
            {joints.some((j) => j.hidden)
              ? "Touching flat faces with matching radius sit hidden inside the solid, so that circle's area is removed twice \u2014 once from each side."
              : "No matching-radius joints between neighbouring solids yet. Match the touching radii to see the hidden area removed, just like in a combination-solid question."}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- main app ------------------------------- */

function SolidsLab() {
  const [shapes, setShapes] = useState(() => [
    { id: "s0", type: "cylinder", color: COLOR_PALETTE[0], params: { ...DEFAULT_PARAMS.cylinder } },
  ]);
  const [cutEnabled, setCutEnabled] = useState(false);
  const [cutOrientation, setCutOrientation] = useState("horizontal");
  const [cutPosition, setCutPosition] = useState(0.5);
  const [cutAngle, setCutAngle] = useState(0);
  const [wireframeOn, setWireframeOn] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width:768px)").matches);
  useEffect(() => {
    const mql = window.matchMedia("(min-width:768px)");
    const onChange = () => setIsDesktopLayout(mql.matches);
    onChange();
    mql.addEventListener ? mql.addEventListener("change", onChange) : mql.addListener(onChange);
    return () => {
      mql.removeEventListener ? mql.removeEventListener("change", onChange) : mql.removeListener(onChange);
    };
  }, []);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const threeRef = useRef({});
  const idCounter = useRef(1);
  const prevLenRef = useRef(shapes.length);

  // mount: renderer, scene, camera, lights, grid, controls, render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const group = new THREE.Group();
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dl1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dl1.position.set(6, 10, 8);
    scene.add(dl1);
    const dl2 = new THREE.DirectionalLight(0xffffff, 0.35);
    dl2.position.set(-6, -4, -6);
    scene.add(dl2);

    const grid = new THREE.GridHelper(14, 14, 0x475569, 0x1e293b);
    scene.add(grid);

    const orbit = { theta: Math.PI / 4, phi: 1.1, radius: 9 };
    function updateCamera() {
      const { theta, phi, radius } = orbit;
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(0, 0, 0);
    }
    updateCamera();

    let dragging = false, lastX = 0, lastY = 0;
    const activePointers = new Map();
    let pinchStartDist = 0, pinchStartRadius = orbit.radius;
    function getPointerDist(map) {
      const pts = Array.from(map.values());
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
    function onPointerDown(e) {
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        dragging = false;
        pinchStartDist = getPointerDist(activePointers);
        pinchStartRadius = orbit.radius;
      } else if (activePointers.size === 1) {
        dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.style.cursor = "grabbing";
      }
    }
    function onPointerMove(e) {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        const dist = getPointerDist(activePointers);
        if (pinchStartDist > 10) {
          orbit.radius = Math.min(Math.max(pinchStartRadius * (pinchStartDist / dist), 2.5), 40);
          updateCamera();
        }
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      orbit.theta -= dx * 0.006;
      orbit.phi = Math.min(Math.max(orbit.phi - dy * 0.006, 0.15), Math.PI - 0.15);
      updateCamera();
    }
    function onPointerUp(e) {
      activePointers.delete(e.pointerId);
      if (activePointers.size === 1) {
        const rem = Array.from(activePointers.values())[0];
        dragging = true; lastX = rem.x; lastY = rem.y;
      } else {
        dragging = false;
      }
      if (activePointers.size === 0) canvas.style.cursor = "grab";
    }
    function onWheel(e) {
      e.preventDefault();
      orbit.radius = Math.min(Math.max(orbit.radius * (1 + e.deltaY * 0.001), 2.5), 40);
      updateCamera();
    }
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    function resize() {
      const w = container.clientWidth, h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let rafId;
    function animate() {
      rafId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    threeRef.current = { renderer, scene, camera, group, grid, orbit, updateCamera };

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      renderer.dispose();
    };
  }, []);

  // rebuild the stack whenever shapes or the cut/wireframe settings change
  useEffect(() => {
    const { group } = threeRef.current;
    if (!group) return undefined;

    const { layout, totalHeight, maxRadius } = layoutShapes(shapes);
    const clippingPlanes = getClipPlanes(cutEnabled, cutOrientation, cutPosition, cutAngle, totalHeight);
    const xOffset = -(maxRadius + 0.7);

    layout.forEach(({ shape, yBottom, yTop }) => {
      const sg = buildShapeGroup(shape, yBottom, yTop, wireframeOn, clippingPlanes);
      group.add(sg);
      if (yTop - yBottom > 0.001) {
        addHeightIndicator(group, yBottom, yTop, xOffset, shape.type === "cube" ? "a" : "h");
      }
    });

    if (cutEnabled && cutOrientation === "horizontal") {
      const yLocal = cutPosition * totalHeight;
      const discGeo = new THREE.CircleGeometry(maxRadius * 1.15, 48);
      const discMat = new THREE.MeshBasicMaterial({ color: 0xf2a541, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.rotation.x = -Math.PI / 2;
      discMesh.position.y = yLocal;
      group.add(discMesh);
    }

    group.position.y = -totalHeight / 2;

    if (threeRef.current.grid) {
      threeRef.current.grid.position.y = -totalHeight / 2 - 0.02;
      const s = Math.max(1, maxRadius / 3);
      threeRef.current.grid.scale.set(s, 1, s);
    }

    return () => {
      while (group.children.length) {
        const obj = group.children.pop();
        disposeObject(obj);
      }
    };
  }, [shapes, cutEnabled, cutOrientation, cutPosition, cutAngle, wireframeOn]);

  // auto-fit the camera whenever the number of shapes changes
  useEffect(() => {
    if (prevLenRef.current !== shapes.length) {
      prevLenRef.current = shapes.length;
      fitView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes.length]);

  function fitView() {
    if (!threeRef.current.orbit) return;
    const { totalHeight, maxRadius } = layoutShapes(shapes);
    const dist = Math.max(totalHeight, maxRadius * 2.2) * 1.25 + 1.4;
    threeRef.current.orbit.radius = Math.min(Math.max(dist, 2.6), 35);
    threeRef.current.updateCamera();
  }

  function addShape(type) {
    setShapes((prev) => {
      const color = COLOR_PALETTE[prev.length % COLOR_PALETTE.length];
      return [...prev, { id: "s" + idCounter.current++, type, color, params: { ...DEFAULT_PARAMS[type] } }];
    });
  }

  function applyPreset(build) {
    setShapes(() => build().map((s, i) => ({
      id: "p" + idCounter.current++,
      color: COLOR_PALETTE[i % COLOR_PALETTE.length],
      ...s,
    })));
    setCutEnabled(false);
  }

  function updateParam(id, key, value) {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, params: { ...s.params, [key]: value } } : s)));
  }
  function toggleFlip(id) {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, params: { ...s.params, flipped: !s.params.flipped } } : s)));
  }
  function removeShape(id) {
    setShapes((prev) => prev.filter((s) => s.id !== id));
  }
  function moveShape(id, direction) {
    setShapes((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[newIdx];
      copy[newIdx] = tmp;
      return copy;
    });
  }
  function updateColor(id, color) {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
  }
  function resetAll() {
    setShapes([]);
    setCutEnabled(false);
  }

  return (
    <div
      style={{ height: "clamp(480px, 78vh, 920px)", backgroundColor: "#0B2545", color: "#E8EEF7", fontFamily: "'Trebuchet MS','Century Gothic',sans-serif" }}
      className="w-full flex flex-col rounded-lg overflow-hidden border border-slate-700"
    >
      <div style={{ borderBottom: "1px solid #274870", backgroundColor: "#0E2C52" }} className="px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>3D Solids Lab</div>
          <div style={{ fontSize: "0.72rem", color: "#8FA9C7" }}>Combination solids, cross-sections and live formulas</div>
        </div>
        <div className="flex gap-2">
          <button onClick={fitView} style={btnGhostStyle}>Fit view</button>
          <button onClick={resetAll} style={btnGhostStyle}>Reset</button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div
          style={{ backgroundColor: "#0E2C52", borderRight: "1px solid #274870", maxHeight: isDesktopLayout ? "none" : "36vh" }}
          className="w-full md:w-72 flex-shrink-0 overflow-y-auto p-3 flex flex-col gap-3 max-h-64 md:max-h-none"
        >
          <div>
            <div style={sectionLabelStyle}>Quick combos</div>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => applyPreset(p.build)} style={btnPresetStyle}>{p.label}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={sectionLabelStyle}>Add a solid</div>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              {SHAPE_TYPES.map((t) => (
                <button key={t.type} onClick={() => addShape(t.type)} style={btnAddStyle}>{t.label}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={sectionLabelStyle}>Stack, bottom to top</div>
            <div className="flex flex-col gap-2 mt-1.5">
              {shapes.length === 0 && (
                <div style={{ fontSize: "0.75rem", color: "#6E89AC" }}>No shapes yet, add one above.</div>
              )}
              {shapes.map((s, i) => (
                <ShapeCard
                  key={s.id}
                  index={i}
                  shape={s}
                  isFirst={i === 0}
                  isLast={i === shapes.length - 1}
                  onChange={(k, v) => updateParam(s.id, k, v)}
                  onFlip={() => toggleFlip(s.id)}
                  onRemove={() => removeShape(s.id)}
                  onMoveUp={() => moveShape(s.id, 1)}
                  onMoveDown={() => moveShape(s.id, -1)}
                  onColor={(c) => updateColor(s.id, c)}
                />
              ))}
            </div>
          </div>

          <div>
            <div style={sectionLabelStyle}>Cross-section</div>
            <label className="flex items-center gap-2 mt-1.5" style={{ fontSize: "0.8rem" }}>
              <input type="checkbox" checked={cutEnabled} onChange={(e) => setCutEnabled(e.target.checked)} />
              Cut open
            </label>
            {cutEnabled && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex gap-2">
                  <button onClick={() => setCutOrientation("horizontal")} style={cutOrientation === "horizontal" ? btnToggleActive : btnToggleStyle}>Horizontal</button>
                  <button onClick={() => setCutOrientation("vertical")} style={cutOrientation === "vertical" ? btnToggleActive : btnToggleStyle}>Vertical</button>
                </div>
                {cutOrientation === "horizontal" ? (
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#8FA9C7" }}>Cut height</div>
                    <input type="range" min={0.02} max={0.98} step={0.01} value={cutPosition} onChange={(e) => setCutPosition(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#F2A541" }} />
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#8FA9C7" }}>Cut angle</div>
                    <input type="range" min={0} max={359} step={1} value={cutAngle} onChange={(e) => setCutAngle(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#F2A541" }} />
                  </div>
                )}
              </div>
            )}
            <label className="flex items-center gap-2 mt-2" style={{ fontSize: "0.8rem" }}>
              <input type="checkbox" checked={wireframeOn} onChange={(e) => setWireframeOn(e.target.checked)} />
              Wireframe
            </label>
          </div>

          <div style={{ fontSize: "0.68rem", color: "#5E7DA3", lineHeight: 1.4 }}>
            Drag to rotate, scroll to zoom.
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div ref={containerRef} className="flex-1 min-h-0" style={{ position: "relative", minHeight: isDesktopLayout ? "440px" : "34vh" }}>
            <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: "none", cursor: "grab" }} />
          </div>
          <div style={{ borderTop: "1px solid #274870", backgroundColor: "#0E2C52", maxHeight: isDesktopLayout ? "150px" : "18vh" }} className="overflow-y-auto p-3 flex-shrink-0">
            <FormulaPanel shapes={shapes} />
          </div>
        </div>
      </div>
    </div>
  );
}

window.SolidsLab = SolidsLab;
