/**
 * The formula list for Equation Flight. Standard textbook formulas only.
 * Edit freely: add, remove or reorder LaTeX strings (KaTeX syntax). Each
 * entry is rendered to HTML once, at module load, never per frame.
 * `star: true` marks well-known formulas that are placed preferentially in
 * the sharp middle band.
 */
export type Formula = { tex: string; star?: boolean };

export const FORMULAS: Formula[] = [
  { tex: String.raw`(x+y)^n=\sum_{k=0}^{n}\binom{n}{k}x^{n-k}y^{k}`, star: true },
  { tex: String.raw`P(A\mid B)=\frac{P(B\mid A)\,P(A)}{P(B)}`, star: true },
  { tex: String.raw`f(x)=\frac{1}{\sigma\sqrt{2\pi}}\,e^{-\frac{(x-\mu)^2}{2\sigma^2}}`, star: true },
  { tex: String.raw`n!\approx\sqrt{2\pi n}\left(\frac{n}{e}\right)^{n}`, star: true },
  { tex: String.raw`E_k=\tfrac{1}{2}mv^2`, star: true },
  { tex: String.raw`C=\frac{Q}{V}` },
  { tex: String.raw`F=G\,\frac{m_1 m_2}{r^2}`, star: true },
  { tex: String.raw`\oint_C \mathbf{B}\cdot d\boldsymbol{\ell}=\mu_0 I_{\mathrm{enc}}`, star: true },
  { tex: String.raw`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`, star: true },
  { tex: String.raw`e^{i\pi}+1=0`, star: true },
  { tex: String.raw`\sum_{k=1}^{n}k=\frac{n(n+1)}{2}` },
  { tex: String.raw`P(A\cup B)=P(A)+P(B)-P(A\cap B)` },
  { tex: String.raw`P(A\cap B)=P(A)\,P(B\mid A)` },
  { tex: String.raw`E=mc^2`, star: true },
  { tex: String.raw`F=ma` },
  { tex: String.raw`e^x=\sum_{n=0}^{\infty}\frac{x^n}{n!}` },
  { tex: String.raw`\int_{-\infty}^{\infty}e^{-x^2}\,dx=\sqrt{\pi}`, star: true },
  { tex: String.raw`a^2+b^2=c^2` },
  { tex: String.raw`\sin^2\theta+\cos^2\theta=1` },
  { tex: String.raw`\frac{d}{dx}\sin x=\cos x` },
  { tex: String.raw`e^{i\theta}=\cos\theta+i\sin\theta` },
  { tex: String.raw`\nabla\cdot\mathbf{E}=\frac{\rho}{\varepsilon_0}` },
  { tex: String.raw`PV=nRT` },
  { tex: String.raw`V=IR` },
  { tex: String.raw`p=mv` },
  { tex: String.raw`\lambda=\frac{h}{p}` },
  { tex: String.raw`E=h\nu` },
  { tex: String.raw`\binom{n}{k}=\frac{n!}{k!\,(n-k)!}` },
  { tex: String.raw`\operatorname{Var}(X)=E[X^2]-(E[X])^2` },
  { tex: String.raw`E[X]=\sum_i x_i\,p_i` },
  { tex: String.raw`\lim_{x\to0}\frac{\sin x}{x}=1` },
  { tex: String.raw`\sum_{n=1}^{\infty}\frac{1}{n^2}=\frac{\pi^2}{6}`, star: true },
  { tex: String.raw`U=\tfrac{1}{2}CV^2` },
  { tex: String.raw`F=-kx` },
  { tex: String.raw`\bar{x}=\frac{1}{n}\sum_{i=1}^{n}x_i` },
  { tex: String.raw`\sigma=\sqrt{\frac{1}{N}\sum_{i=1}^{N}(x_i-\mu)^2}` },
  { tex: String.raw`y=mx+b` },
  { tex: String.raw`\frac{d}{dx}x^n=nx^{n-1}` },
  { tex: String.raw`\int_a^b f'(x)\,dx=f(b)-f(a)` },
  { tex: String.raw`P(X=k)=\binom{n}{k}p^k(1-p)^{n-k}`, star: true },
  { tex: String.raw`W=Fd\cos\theta` },
  { tex: String.raw`\Delta x\,\Delta p\ge\frac{\hbar}{2}` },
  { tex: String.raw`P(X=k)=\frac{\lambda^k e^{-\lambda}}{k!}` },
  { tex: String.raw`P(\bar{A})=1-P(A)` },
];
