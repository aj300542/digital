    const container = document.querySelector(".ants");
    const antsState = [];
    const mappedPoints = [];
    const pointUsage = [];

    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    ctx.font = "bold 500px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "black";
    ctx.fillText(antsTxt, canvas.width / 2, canvas.height / 2);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y += 6) {
      for (let x = 0; x < canvas.width; x += 6) {
        const alpha = imageData.data[(y * canvas.width + x) * 4 + 3];
        if (alpha > 0) {
          mappedPoints.push({
            x: x + cx - canvas.width / 2,
            y: y + cy - canvas.height / 2
          });
        }
      }
    }
    pointUsage.push(...Array(mappedPoints.length).fill(0));
    window.mappedPointsReady = true;

    class EraManager {
      constructor(schedule, onChange) {
        this.schedule = schedule;
        this.onChange = onChange;
        this.currentEra = 0;
        this._startCycle();
        this._syncToClock();
      }
      _startCycle() {
        this.onChange(this.currentEra);
        setTimeout(() => {
          this.currentEra = (this.currentEra + 1) % this.schedule.length;
          this._startCycle();
        }, this.schedule[this.currentEra]);
      }
      _syncToClock() {
        setInterval(() => {
          const now = new Date();
          if (now.getSeconds() === 0) {
            this.currentEra = 0;
            this._startCycle();
          }
        }, 1000);
      }
      getEra() {
        return this.currentEra;
      }
    }

    const eraManager = new EraManager([20000, 3000, 2000, 2000], () => {});

    function isNearDigit(x, y) {
      return mappedPoints.some(pt => {
        const dx = pt.x - x;
        const dy = pt.y - y;
        return dx * dx + dy * dy < 36;
      });
    }

    function findSparseTarget() {
      const sorted = mappedPoints.map((pt, i) => ({
        pt,
        density: pointUsage[i] || 0
      })).sort((a, b) => a.density - b.density);
      const slice = sorted.slice(0, Math.floor(mappedPoints.length * 0.4));
      return slice[Math.floor(Math.random() * slice.length)].pt;
    }

    function getAvoidanceForce(x, y, selfIndex) {
      let fx = 0, fy = 0;
      for (let i = 0; i < antsState.length; i++) {
        if (i === selfIndex || !antsState[i]) continue;
        const other = antsState[i];
        const dx = x - other.x;
        const dy = y - other.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 100) {
          fx += dx / distSq;
          fy += dy / distSq;
        }
      }
      return { x: fx, y: fy };
    }

    function updateLocalDensity(x, y) {
      let minDist = Infinity, idx = -1;
      for (let i = 0; i < mappedPoints.length; i++) {
        const dx = mappedPoints[i].x - x;
        const dy = mappedPoints[i].y - y;
        const d = dx * dx + dy * dy;
        if (d < minDist) {
          minDist = d;
          idx = i;
        }
      }
      if (idx !== -1) pointUsage[idx]++;
    }

    function createAnt(i) {
      const ant = document.createElement("div");
      ant.classList.add("ant");
      container.appendChild(ant);

      let x = cx + Math.random() * 400 - 200;
      let y = cy + Math.random() * 400 - 200;
      antsState[i] = { x, y };
      let converted = false;
      let target = { x: cx, y: cy };
      let noiseOffset = Math.random() * 1000;

      function approach() {
        if (!converted && window.mappedPointsReady) {
          target = mappedPoints[Math.floor(Math.random() * mappedPoints.length)];
          converted = true;
        }

        const dx = target.x - x;
        const dy = target.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let dirX = dx / dist, dirY = dy / dist;
        const avoid = getAvoidanceForce(x, y, i);
        dirX += avoid.x * 0.03;
        dirY += avoid.y * 0.03;
        const t = performance.now() / 1000;
        dirX += Math.sin(t + noiseOffset) * 0.2;
        dirY += Math.cos(t + noiseOffset * 1.3) * 0.2;
        const mag = Math.sqrt(dirX * dirX + dirY * dirY);
        dirX /= mag; dirY /= mag;
        x += dirX * 1.5;
        y += dirY * 1.5;
        ant.style.left = `${x}px`;
        ant.style.top = `${y}px`;
        ant.style.transform = `rotate(${Math.atan2(dirY, dirX)}rad)`;
        antsState[i] = { x, y };
        updateLocalDensity(x, y);
        const era = eraManager.getEra();
        ant.classList.toggle("energized", era === 3 || isNearDigit(x, y));
        if (dist < 5 && converted) {
          setTimeout(hopToNewPoint, 300);
        } else {
          requestAnimationFrame(approach);
        }
      }

      function hopToNewPoint() {
        function hop() {
          const era = eraManager.getEra();
          let newTarget;
          if (era === 1) {
            const center = mappedPoints[Math.floor(mappedPoints.length / 2)];
            const offset = 20 + Math.random() * 20;
            newTarget = {
              x: center.x + (Math.random() - 0.5) * offset,
              y: center.y + (Math.random() - 0.5) * offset
            };
          } else if (era === 2) {
            const angle = Math.random() * Math.PI * 2;
            const rx = 250 + Math.random() * 60;
            const ry = 330 + Math.random() * 60;
            newTarget = {
              x: cx + Math.cos(angle) * rx,
              y: cy + Math.sin(angle) * ry
            };
          } else {
            const base = findSparseTarget();
            const offset = 4 + Math.random() * 8;
            newTarget = {
              x: base.x + (Math.random() - 0.5) * offset,
              y: base.y + (Math.random() - 0.5) * offset
            };
          }

          moveSmoothlyTo(newTarget);
          setTimeout(hop, 3000 + Math.random() * 4000);
        }

        hop();
      }

      function moveSmoothlyTo(p, duration = 1500) {
        const startX = x;
        const startY = y;
        const startTime = performance.now();

        function animate(t) {
          const progress = Math.min((t - startTime) / duration, 1);
          const ease = 0.5 - 0.5 * Math.cos(Math.PI * progress);
          let dx = p.x - startX;
          let dy = p.y - startY;
          let dirX = dx;
          let dirY = dy;

          const avoid = getAvoidanceForce(x, y, i);
          dirX += avoid.x * 0.03;
          dirY += avoid.y * 0.03;
          dirX += Math.sin(t / 500 + noiseOffset) * 0.2;
          dirY += Math.cos(t / 480 + noiseOffset * 1.3) * 0.2;

          const mag = Math.sqrt(dirX * dirX + dirY * dirY);
          if (mag > 0) {
            dirX /= mag;
            dirY /= mag;
          }

          x = startX + dx * ease + avoid.x * 0.2;
          y = startY + dy * ease + avoid.y * 0.2;

          ant.style.left = `${x}px`;
          ant.style.top = `${y}px`;
          ant.style.transform = `rotate(${Math.atan2(dirY, dirX)}rad)`;
          antsState[i] = { x, y };
          updateLocalDensity(x, y);
          const era = eraManager.getEra();
          ant.classList.toggle("energized", era === 3 || isNearDigit(x, y));

          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        }

        requestAnimationFrame(animate);
      }

      approach();
    }

    // 缓变蚁群控制器 + 状态锁
    let morphLocked = false;
    function AntMorphController({ targetCount }) {
      if (morphLocked) return;
      morphLocked = true;

      const currentCount = antsState.length;
      const diff = targetCount - currentCount;

      if (diff > 0) {
        for (let i = 0; i < diff; i++) {
          createAnt(currentCount + i);
        }
        morphLocked = false;
      } else if (diff < 0) {
        let removed = 0;
        for (let i = 0; i < -diff; i++) {
          const index = antsState.length - 1 - i;
          const ant = container.children[index];
          if (!ant) continue;
          ant.style.transition = "opacity 1s, transform 1s";
          ant.style.opacity = "0";
          ant.style.transform += " scale(0.5) rotate(180deg)";
          setTimeout(() => {
            if (ant) ant.remove();
            antsState.splice(index, 1);
            removed++;
            if (removed >= -diff) morphLocked = false;
          }, 1000);
        }
      } else {
        morphLocked = false;
      }
    }

    // 页面加载初始化蚁群
    requestAnimationFrame(() => {
      if (window.mappedPointsReady) {
        window.antsSum = 150;
        AntMorphController({ targetCount: window.antsSum });
      }
    });

    // 滑轨控制蚁群数量（带节流）
    const slider = document.getElementById("antRangeInput");
    const display = document.getElementById("antCountDisplay");
    let morphTimer;

    slider.addEventListener("input", () => {
      const val = parseInt(slider.value, 10);
      display.textContent = val;
      clearTimeout(morphTimer);
      morphTimer = setTimeout(() => {
        window.antsSum = val;
        AntMorphController({ targetCount: val });
      }, 150);
    });