"use client";

import { useMemo, useRef, useState } from "react";
import { FLEET_LENGTHS } from "./lib/crypto/merkle";
import { canPlace, emptyFleet, randomFleet, SHIP_NAMES, shipCells, validateFleet, type FleetPlacement } from "./lib/game/fleet";

type Props = {
  fleet: FleetPlacement[];
  onChange: (fleet: FleetPlacement[]) => void;
  onCommit: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  committed: boolean;
  busy: boolean;
  canCommit: boolean;
  hasRecovery: boolean;
};

export function FleetDeployment({ fleet, onChange, onCommit, onExport, onImport, committed, busy, canCommit, hasRecovery }: Props) {
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState("Select a ship, choose its orientation, then place it on the grid.");
  const fileInput = useRef<HTMLInputElement>(null);
  const validation = useMemo(() => validateFleet(fleet), [fleet]);
  const occupied = useMemo(() => {
    const map = new Map<number, number>();
    fleet.forEach((ship, shipIndex) => {
      if (ship.placed) shipCells(ship, shipIndex).forEach((cell) => map.set(cell, shipIndex));
    });
    return map;
  }, [fleet]);

  function updateShip(shipIndex: number, candidate: FleetPlacement) {
    if (!canPlace(fleet, shipIndex, candidate)) {
      setNotice("That position crosses the grid or overlaps another ship.");
      return;
    }
    onChange(fleet.map((ship, index) => index === shipIndex ? candidate : ship));
    setNotice(`${SHIP_NAMES[shipIndex]} positioned. ${fleet.filter((ship, index) => index !== shipIndex && ship.placed).length + 1}/4 ships ready.`);
  }

  function placeAt(index: number) {
    if (committed) return;
    const existing = occupied.get(index);
    if (existing !== undefined) {
      setSelected(existing);
      setNotice(`${SHIP_NAMES[existing]} selected. Choose another cell to reposition it.`);
      return;
    }
    updateShip(selected, { ...fleet[selected], x: index % 8, y: Math.floor(index / 8), placed: true });
  }

  function rotate(shipIndex: number) {
    if (committed) return;
    const current = fleet[shipIndex];
    const rotated = { ...current, vertical: !current.vertical };
    if (!current.placed) {
      onChange(fleet.map((ship, index) => index === shipIndex ? rotated : ship));
      return;
    }
    updateShip(shipIndex, rotated);
  }

  return (
    <section className="fleet-deployment" aria-labelledby="fleet-title">
      <div className="fleet-heading">
        <div><p className="eyebrow">PRIVATE FLEET</p><h3 id="fleet-title">Deploy your ships.</h3></div>
        <strong className={validation.valid ? "fleet-ready" : ""}>{committed ? "COMMITMENT LOCKED" : validation.valid ? "READY TO COMMIT" : "DEPLOYMENT INCOMPLETE"}</strong>
      </div>
      <div className="fleet-workspace">
        <div className="placement-board" role="grid" aria-label="Fleet placement grid">
          {Array.from({ length: 64 }, (_, index) => {
            const shipIndex = occupied.get(index);
            const coordinate = `${String.fromCharCode(65 + index % 8)}${Math.floor(index / 8) + 1}`;
            return <button key={index} type="button" role="gridcell" aria-label={`${coordinate}${shipIndex !== undefined ? `, ${SHIP_NAMES[shipIndex]}` : ""}`} className={`${shipIndex !== undefined ? "ship-cell" : ""} ${shipIndex === selected ? "selected-ship-cell" : ""}`} onClick={() => placeAt(index)} disabled={committed}><span>{coordinate}</span></button>;
          })}
        </div>
        <div className="fleet-roster">
          {fleet.map((ship, index) => (
            <article key={`${SHIP_NAMES[index]}-${index}`} className={`${selected === index ? "selected" : ""} ${ship.placed ? "placed" : ""}`}>
              <button type="button" className="ship-select" onClick={() => setSelected(index)} disabled={committed}>
                <span>{SHIP_NAMES[index]}</span><small>{FLEET_LENGTHS[index]} CELLS · {ship.placed ? `${String.fromCharCode(65 + ship.x)}${ship.y + 1}` : "UNPLACED"}</small>
              </button>
              <div className="ship-actions"><button type="button" onClick={() => rotate(index)} disabled={committed}>{ship.vertical ? "VERTICAL" : "HORIZONTAL"}</button><button type="button" onClick={() => onChange(fleet.map((item, itemIndex) => itemIndex === index ? { ...item, placed: false } : item))} disabled={committed || !ship.placed}>REMOVE</button></div>
            </article>
          ))}
          <div className="fleet-tools"><button type="button" onClick={() => { onChange(randomFleet()); setNotice("A valid fleet was randomized. Review it before committing."); }} disabled={committed}>RANDOMIZE</button><button type="button" onClick={() => { onChange(emptyFleet()); setSelected(0); setNotice("Fleet cleared."); }} disabled={committed}>RESET</button></div>
          <p className={`fleet-validation ${validation.valid ? "valid" : ""}`} role="status">{validation.valid ? validation.message : notice}</p>
          <button type="button" className="fleet-commit" onClick={onCommit} disabled={busy || committed || !canCommit || !validation.valid}>{busy ? "AWAITING CONFIRMATION..." : committed ? "FLEET COMMITTED" : "LOCK FLEET ON DEVNET"}</button>
          <div className="recovery-actions"><button type="button" onClick={onExport} disabled={!hasRecovery}>EXPORT PRIVATE RECOVERY</button><button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>IMPORT RECOVERY</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ""; }} /></div>
          <p className="secret-warning">Keep the recovery file private. Losing the seed and placements can prevent shot responses and winner verification.</p>
        </div>
      </div>
    </section>
  );
}
