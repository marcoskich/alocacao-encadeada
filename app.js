const SECTOR_SIZE = 4;
const DATA_BYTES = SECTOR_SIZE - 1;
const TOTAL_SECTORS = 28;
const FILE_COLORS = [
  "#4ba3ff",
  "#ff8f61",
  "#a16bff",
  "#4cd964",
  "#ff5f56",
  "#ffd166",
  "#7ac7ff",
  "#f375ff"
];

const state = {
  sectors: [],
  files: [],
  nextFileId: 1
};

const elements = {
  form: document.getElementById("file-form"),
  name: document.getElementById("file-name"),
  content: document.getElementById("file-content"),
  preferredSector: document.getElementById("preferred-sector"),
  feedback: document.getElementById("feedback"),
  fileTableBody: document.getElementById("file-table-body"),
  resetButton: document.getElementById("reset-disk"),
  diskGrid: document.getElementById("disk-grid"),
  diskCapacity: document.getElementById("disk-capacity"),
  diskUsage: document.getElementById("disk-usage"),
  diskFreeRanges: document.getElementById("disk-free-ranges"),
  sectorTemplate: document.getElementById("sector-template")
};

initDisk(TOTAL_SECTORS);
render();
registerEvents();

function initDisk(total) {
  state.sectors = Array.from({ length: total }, (_, index) => ({
    id: index,
    bytes: Array(DATA_BYTES).fill(""),
    pointer: "",
    fileId: null
  }));
  state.files = [];
  state.nextFileId = 1;
}

function registerEvents() {
  elements.form.addEventListener("submit", handleAddFile);
  elements.resetButton.addEventListener("click", handleResetDisk);
  elements.fileTableBody.addEventListener("click", (event) => {
    const target = event.target;
    if (target.matches("button[data-action=remove]")) {
      const fileId = Number(target.dataset.fileId);
      removeFile(fileId);
    }
  });
}

function handleAddFile(event) {
  event.preventDefault();
  const name = elements.name.value.trim();
  const contentRaw = elements.content.value.replace(/\r\n/g, "\n");
  const content = contentRaw.replace(/\n/g, " ");
  const preferredSector = elements.preferredSector.value ? Number(elements.preferredSector.value) : null;

  if (!name) {
    return displayFeedback("Informe um nome para o arquivo.", "error");
  }

  if (nameAlreadyExists(name)) {
    return displayFeedback("Ja existe um arquivo com este nome.", "error");
  }

  if (!content.length) {
    return displayFeedback("Digite algum conteudo para armazenar.", "error");
  }

  if (preferredSector !== null) {
    if (!Number.isInteger(preferredSector) || preferredSector < 1 || preferredSector > state.sectors.length) {
      return displayFeedback("Setor inicial preferido fora do intervalo.", "error");
    }
  }

  const allocationResult = allocateFile(name, content, preferredSector);
  if (!allocationResult.ok) {
    return displayFeedback(allocationResult.message, "error");
  }

  elements.form.reset();
  displayFeedback(`Arquivo "${name}" gravado com sucesso.`, "success");
  render();
}

function handleResetDisk() {
  const shouldReset = confirm("Deseja realmente limpar o disco? Todos os arquivos serao removidos.");
  if (!shouldReset) {
    return;
  }
  initDisk(TOTAL_SECTORS);
  render();
  displayFeedback("Disco limpo.", "success");
}

function nameAlreadyExists(name) {
  return state.files.some((file) => file.name.toLowerCase() === name.toLowerCase());
}

function allocateFile(name, content, preferredSector) {
  const dataBytes = Array.from(content);
  const sectorsNeeded = Math.ceil(dataBytes.length / DATA_BYTES);
  const freeSectors = state.sectors.filter((sector) => sector.fileId === null).map((sector) => sector.id);

  if (preferredSector !== null && !freeSectors.includes(preferredSector - 1)) {
    return { ok: false, message: "Setor preferido ja esta ocupado." };
  }

  if (freeSectors.length < sectorsNeeded) {
    return { ok: false, message: "Espaco insuficiente no disco para este arquivo." };
  }

  const allocation = [];

  if (preferredSector !== null) {
    allocation.push(preferredSector - 1);
  }

  for (const sectorId of freeSectors) {
    if (allocation.length === sectorsNeeded) {
      break;
    }
    if (!allocation.includes(sectorId)) {
      allocation.push(sectorId);
    }
  }

  const fileId = state.nextFileId++;
  const color = FILE_COLORS[(fileId - 1) % FILE_COLORS.length];
  const sectorsUsed = [];

  allocation.forEach((sectorIndex, allocationIndex) => {
    const sector = state.sectors[sectorIndex];
    const dataChunk = dataBytes.splice(0, DATA_BYTES);

    for (let i = 0; i < DATA_BYTES; i += 1) {
      sector.bytes[i] = dataChunk[i] || "";
    }

    const hasNext = allocationIndex < allocation.length - 1;
    sector.pointer = hasNext ? String(allocation[allocationIndex + 1] + 1) : "&";
    sector.fileId = fileId;
    sectorsUsed.push(sectorIndex);
  });

  state.files.push({
    id: fileId,
    name,
    size: content.length,
    startSector: allocation[0] + 1,
    sectors: sectorsUsed,
    color
  });

  return { ok: true };
}

function removeFile(fileId) {
  const fileIndex = state.files.findIndex((file) => file.id === fileId);
  if (fileIndex === -1) {
    return;
  }

  const file = state.files[fileIndex];
  file.sectors.forEach((sectorIndex) => {
    const sector = state.sectors[sectorIndex];
    sector.fileId = null;
  });

  state.files.splice(fileIndex, 1);
  displayFeedback(`Arquivo "${file.name}" removido.`, "success");
  render();
}

function render() {
  renderFileTable();
  renderDisk();
  renderDiskInfo();
}

function renderFileTable() {
  elements.fileTableBody.innerHTML = "";

  if (state.files.length === 0) {
    const row = document.createElement("tr");
    row.className = "empty";
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "Nenhum arquivo adicionado ainda.";
    row.appendChild(cell);
    elements.fileTableBody.appendChild(row);
    return;
  }

  state.files.forEach((file) => {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    const tag = document.createElement("span");
    tag.className = "file-tag";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = file.color;
    const label = document.createElement("span");
    label.textContent = file.name;
    tag.append(dot, label);
    nameCell.appendChild(tag);

    const sizeCell = document.createElement("td");
    sizeCell.textContent = `${file.size}`;

    const startCell = document.createElement("td");
    startCell.textContent = file.startSector;

    const sectorsCell = document.createElement("td");
    sectorsCell.textContent = file.sectors.map((index) => index + 1).join(", ");

    const actionsCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.dataset.action = "remove";
    removeButton.dataset.fileId = String(file.id);
    removeButton.className = "danger";
    removeButton.textContent = "Remover";
    actionsCell.appendChild(removeButton);

    row.append(nameCell, sizeCell, startCell, sectorsCell, actionsCell);
    elements.fileTableBody.appendChild(row);
  });
}

function renderDisk() {
  elements.diskGrid.innerHTML = "";

  state.sectors.forEach((sector) => {
    const sectorElement = elements.sectorTemplate.content.firstElementChild.cloneNode(true);
    const sectorNumber = sectorElement.querySelector("[data-sector]");
    const ownerDisplay = sectorElement.querySelector("[data-owner]");
    const bytesContainer = sectorElement.querySelector("[data-bytes]");

    sectorNumber.textContent = sector.id + 1;
    sectorElement.classList.remove("sector--free");
    sectorElement.style.borderColor = "";

    if (sector.fileId) {
      const file = state.files.find((item) => item.id === sector.fileId);
      ownerDisplay.textContent = file ? file.name : "";
      sectorElement.style.borderColor = file ? file.color : "";
    } else {
      const hasResidualData = sector.bytes.some(Boolean) || Boolean(sector.pointer);
      ownerDisplay.textContent = hasResidualData ? "Livre (residual)" : "Livre";
      sectorElement.classList.add("sector--free");
    }

    bytesContainer.innerHTML = "";

    sector.bytes.forEach((value) => {
      const cell = document.createElement("div");
      cell.className = "byte-cell";
      if (value) {
        cell.dataset.filled = "true";
        cell.textContent = value;
      }
      bytesContainer.appendChild(cell);
    });

    const pointerCell = document.createElement("div");
    pointerCell.className = "byte-cell";
    pointerCell.dataset.role = "pointer";
    if (sector.pointer) {
      pointerCell.dataset.filled = "true";
      pointerCell.textContent = sector.pointer;
    } else {
      pointerCell.textContent = "";
    }
    bytesContainer.appendChild(pointerCell);

    elements.diskGrid.appendChild(sectorElement);
  });
}

function renderDiskInfo() {
  const usedSectors = state.sectors.filter((sector) => sector.fileId !== null).length;
  const totalDataBytes = state.files.reduce((acc, file) => acc + file.size, 0);
  const freeSectors = state.sectors
    .filter((sector) => sector.fileId === null)
    .map((sector) => sector.id + 1);
  elements.diskCapacity.textContent = `${state.sectors.length} setores - ${SECTOR_SIZE} bytes por setor (${DATA_BYTES} dados + 1 ponteiro)`;
  elements.diskUsage.textContent = `Uso: ${usedSectors}/${state.sectors.length} setores - ${totalDataBytes} bytes de dados`;
  if (elements.diskFreeRanges) {
    elements.diskFreeRanges.textContent = freeSectors.length ? formatRanges(freeSectors) : "Nenhum";
  }
}

function displayFeedback(message, type) {
  elements.feedback.textContent = message;
  elements.feedback.className = type ? type : "";
}

function formatRanges(numbers) {
  if (numbers.length === 0) {
    return "";
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const result = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i += 1) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    result.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = current;
    prev = current;
  }

  return result.join(", ");
}
