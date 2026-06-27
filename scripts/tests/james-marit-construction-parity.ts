/**
 * James–Marit construction parity gate (run BEFORE deleting the nested support).
 *
 * Independent NESTED reference implementation of the construction (the "old
 * method of generation" — nested 3×3 arithmetic + RREF cocycle + 4×4 assembly,
 * transcribed from demos/james-marit-new) vs the new FLAT `examples/james-marit`
 * pipeline. Two independent implementations agreeing bit-for-bit across a sweep
 * of (s, α) proves the rewrite preserved the rep.
 *
 *   node scripts/tests/james-marit-construction-parity.ts
 */

import { DEFAULT_REP, defaultMultipliers } from '../../src/examples/james-marit/so21Rep.ts';
import { makeCohomology } from '../../src/examples/james-marit/cohomology.ts';
import { cocycleSpace, combineBasis } from '../../src/examples/james-marit/cocycle.ts';
import { scaledBlocks, jamesMaritGenerators } from '../../src/examples/james-marit/recipe.ts';
import { matDim } from '../../src/core/matrix.ts';

// ── independent nested reference (mirrors the old demo's symSquare/cocycle/repBuilder) ──
type M3 = number[][];
const S2 = Math.SQRT2;
const REF_A: M3 = [[3 + 2 * S2, 0, 0], [0, 1, 0], [0, 0, 3 - 2 * S2]];
const REF_B: M3 = [[2, S2, 1], [2 * S2, 3, 2 * S2], [1, S2, 2]];
const mul = (a: M3, b: M3): M3 => { const o: M3 = [[0,0,0],[0,0,0],[0,0,0]]; for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=a[i][k]*b[k][j];o[i][j]=s;} return o; };
const sub = (a: M3, b: M3): M3 => a.map((r,i)=>r.map((x,j)=>x-b[i][j]));
const scl = (m: M3, s: number): M3 => m.map(r=>r.map(x=>s*x));
const I3: M3 = [[1,0,0],[0,1,0],[0,0,1]];
const det = (m: M3): number => m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
const inv = (m: M3): M3 => { const d=1/det(m); return [
  [(m[1][1]*m[2][2]-m[1][2]*m[2][1])*d, -(m[0][1]*m[2][2]-m[0][2]*m[2][1])*d, (m[0][1]*m[1][2]-m[0][2]*m[1][1])*d],
  [-(m[1][0]*m[2][2]-m[1][2]*m[2][0])*d, (m[0][0]*m[2][2]-m[0][2]*m[2][0])*d, -(m[0][0]*m[1][2]-m[0][2]*m[1][0])*d],
  [(m[1][0]*m[2][1]-m[1][1]*m[2][0])*d, -(m[0][0]*m[2][1]-m[0][1]*m[2][0])*d, (m[0][0]*m[1][1]-m[0][1]*m[1][0])*d]]; };

function refCocycleBasis(A: M3, B: M3): number[][] {
  const Ai = inv(A), Bi = inv(B);
  const Ma = mul(mul(sub(B, I3), Ai), Bi), Mb = mul(sub(Ai, I3), Bi);
  const C: number[][] = [[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]];
  for (let i=0;i<3;i++) for (let j=0;j<3;j++){ C[i][j]=Ma[j][i]; C[i][j+3]=Mb[j][i]; }
  // RREF nullspace (3×6)
  const Aug=C.map(r=>r.slice()); const piv:number[]=[]; let r=0;
  for(let c=0;c<6&&r<3;c++){ let best=r,bv=Math.abs(Aug[r][c]); for(let i=r+1;i<3;i++){const v=Math.abs(Aug[i][c]);if(v>bv){bv=v;best=i;}} if(bv<1e-10)continue; if(best!==r)[Aug[r],Aug[best]]=[Aug[best],Aug[r]]; const iv=1/Aug[r][c]; for(let j=c;j<6;j++)Aug[r][j]*=iv; for(let i=0;i<3;i++){if(i===r)continue;const f=Aug[i][c];if(Math.abs(f)<1e-14)continue;for(let j=c;j<6;j++)Aug[i][j]-=f*Aug[r][j];} piv.push(c);r++; }
  const isP=new Array(6).fill(false); for(const c of piv)isP[c]=true;
  const raw:number[][]=[]; for(let fc=0;fc<6;fc++){ if(isP[fc])continue; const v=new Array(6).fill(0);v[fc]=1; for(let i=0;i<r;i++)v[piv[i]]=-Aug[i][fc]; raw.push(v); }
  // gram-schmidt
  const out:number[][]=[]; for(const v of raw){ const u=v.slice(); for(const e of out){let d=0;for(let i=0;i<6;i++)d+=u[i]*e[i];for(let i=0;i<6;i++)u[i]-=d*e[i];} let n=0;for(const x of u)n+=x*x;n=Math.sqrt(n);if(n<1e-12)continue;for(let i=0;i<6;i++)u[i]/=n;out.push(u); }
  return out;
}

const TOL = 1e-12;
let worstBlock = 0, worstBasis = 0, worstGen = 0, failures = 0;
const kA = Math.log(REF_A[0][0]);

for (const s of [0, 0.3, 0.7, 1.0]) {
  for (const alphas of [[1,0,0],[0,1,0],[0,0,1],[2.5,-1.3,0.7]]) {
    // reference (nested)
    const refBlA = scl(REF_A, Math.exp(-s*kA)), refBlB = scl(REF_B, Math.exp(0));
    const refBasis = refCocycleBasis(refBlA, refBlB);
    const refV = [0,0,0,0,0,0]; for(let i=0;i<Math.min(refBasis.length,3);i++)for(let j=0;j<6;j++)refV[j]+=alphas[i]*refBasis[i][j];
    const refGen = (bl: M3, v: number[]): number[] => [bl[0][0],bl[0][1],bl[0][2],0, bl[1][0],bl[1][1],bl[1][2],0, bl[2][0],bl[2][1],bl[2][2],0, v[0],v[1],v[2],1];
    const refGA = refGen(refBlA, [refV[0],refV[1],refV[2]]), refGB = refGen(refBlB, [refV[3],refV[4],refV[5]]);

    // new flat
    const m = defaultMultipliers(DEFAULT_REP), co = makeCohomology(m.kA, m.kB, s), bl = scaledBlocks(DEFAULT_REP, co);
    const sp = cocycleSpace(bl.A, bl.B), v = combineBasis(sp.basis, alphas);
    const [gA, gB] = jamesMaritGenerators(bl, v);

    const refBlAflat = [refBlA[0],refBlA[1],refBlA[2]].flat();
    for (let i=0;i<9;i++) worstBlock = Math.max(worstBlock, Math.abs(refBlAflat[i] - bl.A[i]));
    if (refBasis.length !== sp.basis.length) { failures++; console.log(`basis count mismatch s=${s}`); }
    for (let b=0;b<sp.basis.length;b++) for (let i=0;i<6;i++) worstBasis = Math.max(worstBasis, Math.abs(refBasis[b][i] - sp.basis[b][i]));
    for (let i=0;i<16;i++) { worstGen = Math.max(worstGen, Math.abs(refGA[i]-gA[i]), Math.abs(refGB[i]-gB[i])); }
    if (matDim(gA) !== 4) failures++;
  }
}

const pass = worstBlock<=TOL && worstBasis<=TOL && worstGen<=TOL && failures===0;
console.log(`scaled blocks:  max|Δ| = ${worstBlock.toExponential(2)}`);
console.log(`cocycle basis:  max|Δ| = ${worstBasis.toExponential(2)}`);
console.log(`4×4 generators: max|Δ| = ${worstGen.toExponential(2)}`);
console.log(pass ? `\nJames–Marit construction parity PASSED (tol ${TOL}).` : `\nFAILED.`);
process.exit(pass ? 0 : 1);
