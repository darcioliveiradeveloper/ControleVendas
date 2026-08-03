function pad(valor) {
  return String(valor).padStart(2, '0');
}

function agoraLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function adicionarMeses(data, meses) {
  const [ano, mes, dia] = String(data).split('-').map(Number);
  const d = new Date(ano, mes - 1 + meses, dia);
  const a = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  return `${a}-${m}-${dd}`;
}

function arredondar(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

function calcularPrecoVenda(custo, margem) {
  const custoNum = Number(custo) || 0;
  const margemNum = Number(margem) || 0;
  return Math.round(custoNum * (1 + margemNum / 100) * 100) / 100;
}

function calcularMargemPercentual(custo, venda) {
  const custoNum = Number(custo) || 0;
  const vendaNum = Number(venda) || 0;
  if (!custoNum || vendaNum < 0) return 0;
  return Math.round(((vendaNum - custoNum) / custoNum) * 10000) / 100;
}

function intervaloDia(inicio, fim) {
  if (!inicio || !fim) return null;
  return { inicio: `${inicio} 00:00:00`, fim: `${fim} 23:59:59` };
}

module.exports = { agoraLocal, hoje, adicionarMeses, arredondar, calcularPrecoVenda, calcularMargemPercentual, intervaloDia };
