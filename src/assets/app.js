/**
 * Uptime Monitor - Lógica Frontend Principal
 * Responsável por: Polling de API, Gerenciamento de Gráficos, 
 * Alertas Sonoros e Manipulação do DOM.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Configurações e Estado Global ---
    const API_URL = 'api.php';
    let monitors = [];
    let activeMonitorId = null;
    let latencyChart = null;
    let isSoundMuted = false; // Alertas sonoros ATIVOS por padrão
    let pollIntervals = {}; // Armazena timers por ID de monitor

    // --- Seletores de Elementos ---
    const monitorsList = document.getElementById('monitors-list');
    const statTotal = document.getElementById('stat-total');
    const statUp = document.getElementById('stat-up');
    const statDown = document.getElementById('stat-down');
    const statLatency = document.getElementById('stat-latency');
    const updateIndicator = document.getElementById('update-indicator');

    // Filtros e Ordenação
    const filterSearchInput = document.getElementById('filter-search-input');
    const filterCategorySelect = document.getElementById('filter-category-select');
    const sortBySelect = document.getElementById('sort-by-select');
    let searchQuery = '';
    let selectedCategoryFilter = '';
    let currentSortMode = 'default';
    
    // Modal Novo Monitor
    const modal = document.getElementById('monitor-modal');
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const monitorForm = document.getElementById('monitor-form');
    const monitorCategories = document.getElementById('monitor-categories');

    // Modal de Edição
    const editModal = document.getElementById('edit-modal');
    const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
    const cancelEditModalBtn = document.getElementById('cancel-edit-modal-btn');
    const editForm = document.getElementById('edit-form');
    const editMonitorId = document.getElementById('edit-monitor-id');
    const editMonitorName = document.getElementById('edit-monitor-name');
    const editMonitorUrl = document.getElementById('edit-monitor-url');
    const editMonitorInterval = document.getElementById('edit-monitor-interval');
    const editMonitorCategories = document.getElementById('edit-monitor-categories');

    // Modal de Importação
    const importModal = document.getElementById('import-modal');
    const openImportModalBtn = document.getElementById('open-import-modal-btn');
    const closeImportModalBtn = document.getElementById('close-import-modal-btn');
    const cancelImportModalBtn = document.getElementById('cancel-import-modal-btn');
    const importForm = document.getElementById('import-form');

    // Navegação de Vistas (SPA In-Page)
    const viewDashboard = document.getElementById('view-dashboard');
    const viewDocs = document.getElementById('view-docs');
    const navTabMonitors = document.getElementById('nav-tab-monitors');
    const navTabDocs = document.getElementById('nav-tab-docs');
    const navLogo = document.getElementById('nav-logo');
    const docsSearchInput = document.getElementById('docs-search-input');

    // Som
    const toggleSoundBtn = document.getElementById('toggle-sound-btn');
    const soundStatusText = document.getElementById('sound-status');
    const soundIcon = toggleSoundBtn.querySelector('.sound-icon');

    // Modal de Detalhes & Gráfico
    const detailsModal = document.getElementById('details-modal');
    const modalMonitorName = document.getElementById('modal-monitor-name');
    const modalMonitorUrl = document.getElementById('modal-monitor-url');
    const modalStatusBadge = document.getElementById('modal-status-badge');
    const modalStatusCode = document.getElementById('modal-status-code');
    const modalLatencyValue = document.getElementById('modal-latency-value');
    const modalIntervalValue = document.getElementById('modal-interval-value');
    const modalCategoriesValue = document.getElementById('modal-categories-value');
    const modalLastCheck = document.getElementById('modal-last-check');
    const closeDetailsModalBtn = document.getElementById('close-details-modal-btn');
    const closeDetailsFooterBtn = document.getElementById('close-details-footer-btn');

    // --- Inicialização ---
    init();

    async function init() {
        setupEventListeners();
        await loadMonitors();
        updateStats();
        
        // Inicia polling global de estatísticas a cada 30s
        setInterval(updateStats, 30000);
    }

    function switchView(viewTarget) {
        if (viewTarget === 'docs') {
            if (viewDashboard) viewDashboard.classList.add('hidden');
            if (viewDocs) viewDocs.classList.remove('hidden');
            if (navTabMonitors) navTabMonitors.classList.remove('active');
            if (navTabDocs) navTabDocs.classList.add('active');
            if (docsSearchInput) docsSearchInput.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            if (viewDocs) viewDocs.classList.add('hidden');
            if (viewDashboard) viewDashboard.classList.remove('hidden');
            if (navTabDocs) navTabDocs.classList.remove('active');
            if (navTabMonitors) navTabMonitors.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function setupEventListeners() {
        // Navegação de Vistas da Página Principal
        if (navTabMonitors) navTabMonitors.addEventListener('click', () => switchView('dashboard'));
        if (navTabDocs) navTabDocs.addEventListener('click', () => switchView('docs'));
        if (navLogo) navLogo.addEventListener('click', () => switchView('dashboard'));

        // Modal Novo Monitor
        if (openModalBtn) {
            openModalBtn.addEventListener('click', () => modal.classList.remove('hidden'));
        }
        [closeModalBtn, cancelModalBtn].forEach(btn => {
            if (btn) btn.addEventListener('click', () => modal.classList.add('hidden'));
        });

        // Modal Edição
        [closeEditModalBtn, cancelEditModalBtn].forEach(btn => {
            if (btn && editModal) btn.addEventListener('click', () => editModal.classList.add('hidden'));
        });

        if (editForm) {
            editForm.addEventListener('submit', handleUpdateMonitor);
        }

        // Modal Importar Lista
        if (openImportModalBtn) {
            openImportModalBtn.addEventListener('click', () => importModal.classList.remove('hidden'));
        }
        [closeImportModalBtn, cancelImportModalBtn].forEach(btn => {
            if (btn) btn.addEventListener('click', () => importModal.classList.add('hidden'));
        });

        // Busca em Tempo Real na Documentação
        if (docsSearchInput) {
            docsSearchInput.addEventListener('input', handleDocsSearch);
        }

        // Modal Detalhes do Domínio
        [closeDetailsModalBtn, closeDetailsFooterBtn].forEach(btn => {
            if (btn && detailsModal) {
                btn.addEventListener('click', () => {
                    detailsModal.classList.add('hidden');
                    activeMonitorId = null;
                    document.querySelectorAll('.monitor-card').forEach(c => c.classList.remove('active'));
                });
            }
        });

        // Fechar modais ao clicar fora (no fundo escuro / overlay)
        [modal, importModal, detailsModal, editModal].forEach(m => {
            if (m) {
                m.addEventListener('click', (e) => {
                    if (e.target === m) {
                        m.classList.add('hidden');
                        if (m === detailsModal) {
                            activeMonitorId = null;
                            document.querySelectorAll('.monitor-card').forEach(c => c.classList.remove('active'));
                        }
                    }
                });
            }
        });

        // Submit Formulário Novo Monitor
        if (monitorForm) {
            monitorForm.addEventListener('submit', handleAddMonitor);
        }

        // Submit Formulário Importação
        if (importForm) {
            importForm.addEventListener('submit', handleImportMonitors);
            setupFileImportListeners();
        }

        // Som
        if (toggleSoundBtn) {
            toggleSoundBtn.addEventListener('click', toggleSound);
        }

        // Busca por Nome / Domínio, Categoria e Ordenação
        if (filterSearchInput) {
            filterSearchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase().trim();
                renderMonitors();
            });
        }

        if (filterCategorySelect) {
            filterCategorySelect.addEventListener('change', (e) => {
                selectedCategoryFilter = e.target.value;
                renderMonitors();
            });
        }

        if (sortBySelect) {
            sortBySelect.addEventListener('change', (e) => {
                currentSortMode = e.target.value;
                renderMonitors();
            });
        }
    }

    function handleDocsSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        const docCards = document.querySelectorAll('.docs-content-body .doc-card');
        const emptyState = document.getElementById('docs-empty-state');
        let visibleCount = 0;

        docCards.forEach(card => {
            const keywords = (card.dataset.keywords || '').toLowerCase();
            const text = card.textContent.toLowerCase();
            
            if (!query || keywords.includes(query) || text.includes(query)) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        if (emptyState) {
            if (visibleCount === 0) emptyState.classList.remove('hidden');
            else emptyState.classList.add('hidden');
        }
    }

    // --- Lógica de API ---

    async function loadMonitors() {
        showLoading(true);
        try {
            const response = await fetch(`${API_URL}?action=list_monitors`);
            const result = await response.json();
            
            if (result.success) {
                monitors = result.data;
                updateCategoryFilterOptions();
                renderMonitors();
                setupPollings();
            }
        } catch (error) {
            console.error('Erro ao carregar monitores:', error);
        } finally {
            showLoading(false);
        }
    }

    function updateCategoryFilterOptions() {
        if (!filterCategorySelect) return;

        const categoriesSet = new Set();
        monitors.forEach(m => {
            if (m.categories) {
                m.categories.split(',').map(c => c.trim()).filter(Boolean).forEach(c => categoriesSet.add(c));
            }
        });

        const currentSelection = filterCategorySelect.value;
        filterCategorySelect.innerHTML = '<option value="">Todas as Categorias</option>';
        Array.from(categoriesSet).sort().forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (cat === currentSelection) opt.selected = true;
            filterCategorySelect.appendChild(opt);
        });
    }

    async function handleAddMonitor(e) {
        e.preventDefault();
        const formData = {
            name: document.getElementById('monitor-name').value,
            url: document.getElementById('monitor-url').value,
            check_interval: parseInt(document.getElementById('monitor-interval').value),
            categories: monitorCategories ? monitorCategories.value : ''
        };

        try {
            const response = await fetch(`${API_URL}?action=create_monitor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await response.json();

            if (result.success) {
                modal.classList.add('hidden');
                monitorForm.reset();
                await loadMonitors();
                updateStats();
            } else {
                alert('Erro: ' + result.error);
            }
        } catch (error) {
            alert('Falha na comunicação com o servidor.');
        }
    }

    function openEditModal(id) {
        const m = monitors.find(mon => mon.id == id);
        if (!m || !editModal) return;

        if (editMonitorId) editMonitorId.value = m.id;
        if (editMonitorName) editMonitorName.value = m.name;
        if (editMonitorUrl) editMonitorUrl.value = m.url;
        if (editMonitorInterval) editMonitorInterval.value = m.check_interval;
        if (editMonitorCategories) editMonitorCategories.value = m.categories || '';

        editModal.classList.remove('hidden');
    }

    async function handleUpdateMonitor(e) {
        e.preventDefault();
        const formData = {
            id: parseInt(editMonitorId.value),
            name: editMonitorName.value,
            url: editMonitorUrl.value,
            check_interval: parseInt(editMonitorInterval.value),
            categories: editMonitorCategories ? editMonitorCategories.value : ''
        };

        try {
            const response = await fetch(`${API_URL}?action=update_monitor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await response.json();

            if (result.success) {
                editModal.classList.add('hidden');
                editForm.reset();
                await loadMonitors();
                updateStats();
            } else {
                alert('Erro ao atualizar: ' + result.error);
            }
        } catch (error) {
            alert('Falha na comunicação com o servidor.');
        }
    }

    function setupFileImportListeners() {
        const importFileInput = document.getElementById('import-file-input');
        const fileDropArea = document.getElementById('file-drop-area');
        const fileStatusBadge = document.getElementById('file-status-badge');
        const clearFileBtn = document.getElementById('clear-file-btn');
        const importUrlsTextarea = document.getElementById('import-urls');

        if (!importFileInput || !fileDropArea) return;

        // Seleção via input de arquivo
        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleSelectedFile(file);
        });

        // Eventos de Drag & Drop
        ['dragenter', 'dragover'].forEach(eventName => {
            fileDropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileDropArea.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            fileDropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileDropArea.classList.remove('dragover');
            }, false);
        });

        fileDropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                handleSelectedFile(files[0]);
            }
        });

        // Botão para limpar arquivo selecionado
        if (clearFileBtn) {
            clearFileBtn.addEventListener('click', () => {
                importFileInput.value = '';
                if (fileStatusBadge) fileStatusBadge.classList.add('hidden');
                if (importUrlsTextarea) importUrlsTextarea.value = '';
            });
        }

        // Atualizador do contador com edição manual
        if (importUrlsTextarea) {
            importUrlsTextarea.addEventListener('input', () => {
                const urls = importUrlsTextarea.value.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
                const fileStatusName = document.getElementById('file-status-name');
                const fileStatusCount = document.getElementById('file-status-count');
                if (urls.length > 0 && fileStatusBadge && fileStatusName && fileStatusCount) {
                    fileStatusName.textContent = 'Lista digitada/carregada';
                    fileStatusCount.textContent = `${urls.length} URL${urls.length !== 1 ? 's' : ''}`;
                    fileStatusBadge.classList.remove('hidden');
                } else if (fileStatusBadge) {
                    fileStatusBadge.classList.add('hidden');
                }
            });
        }
    }

    function handleSelectedFile(file) {
        const fileStatusBadge = document.getElementById('file-status-badge');
        const fileStatusName = document.getElementById('file-status-name');
        const fileStatusCount = document.getElementById('file-status-count');
        const importUrlsTextarea = document.getElementById('import-urls');

        if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
            alert('Por favor, selecione um arquivo de texto (.txt) válido.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            if (importUrlsTextarea) importUrlsTextarea.value = content;

            const urls = content.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
            if (fileStatusBadge && fileStatusName && fileStatusCount) {
                fileStatusName.textContent = file.name;
                fileStatusCount.textContent = `${urls.length} URL${urls.length !== 1 ? 's' : ''}`;
                fileStatusBadge.classList.remove('hidden');
            }
        };
        reader.readAsText(file);
    }

    async function handleImportMonitors(e) {
        e.preventDefault();
        const textarea = document.getElementById('import-urls');
        const urlsText = textarea.value;
        
        // Divide por quebra de linha ou vírgula, limpa espaços e ignora linhas vazias
        const rawUrls = urlsText.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
        
        if (rawUrls.length === 0) {
            alert('Por favor, insira pelo menos uma URL válida ou selecione um arquivo TXT.');
            return;
        }

        const submitBtn = document.getElementById('import-submit-btn') || importForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Importando (${rawUrls.length} sites)...`;

        const monitorsToImport = rawUrls.map(rawUrl => {
            const sanitizedUrl = sanitizeUrl(rawUrl);
            const name = extractDomainName(sanitizedUrl);
            return {
                name: name,
                url: sanitizedUrl,
                check_interval: 60 // 1 minuto por padrão (requisito do usuário)
            };
        });

        try {
            const response = await fetch(`${API_URL}?action=import_monitors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monitors: monitorsToImport })
            });
            const result = await response.json();

            if (result.success) {
                const fileStatusBadge = document.getElementById('file-status-badge');
                importModal.classList.add('hidden');
                importForm.reset();
                if (fileStatusBadge) fileStatusBadge.classList.add('hidden');

                alert(`Importação concluída com sucesso!\n\n${result.imported_count} monitores com frequência de 1 min criados.`);
                await loadMonitors();
                updateStats();
            } else {
                alert('Erro ao importar lista: ' + (result.error || 'Erro desconhecido.'));
            }
        } catch (error) {
            console.error('Falha de rede ao importar lote:', error);
            alert('Falha na comunicação com o servidor durante a importação.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }

    function sanitizeUrl(url) {
        let trimmed = url.trim();
        if (!trimmed) return '';
        // Se a URL não começar com http:// ou https://, adicionamos https:// por padrão
        if (!/^(https?:\/\/)/i.test(trimmed)) {
            trimmed = 'https://' + trimmed;
        }
        return trimmed;
    }

    function extractDomainName(url) {
        try {
            const parsed = new URL(url);
            let host = parsed.hostname.replace(/^www\./i, '');
            return host || url;
        } catch (e) {
            let cleaned = url.replace(/^(https?:\/\/)?(www\.)?/i, '');
            let host = cleaned.split('/')[0].split(':')[0];
            return host || 'Site';
        }
    }

    async function deleteMonitor(id) {
        if (!confirm('Tem certeza que deseja remover este monitor? Todo o histórico será excluído.')) return;

        try {
            const response = await fetch(`${API_URL}?action=delete_monitor&id=${id}`, { method: 'POST' });
            const result = await response.json();

            if (result.success) {
                // Limpa pollings e estado se for o ativo
                if (pollIntervals[id]) clearInterval(pollIntervals[id]);
                delete pollIntervals[id];
                
                if (activeMonitorId === id) {
                    closeChart();
                }

                await loadMonitors();
                updateStats();
            }
        } catch (error) {
            console.error('Erro ao excluir:', error);
        }
    }

    async function toggleMute(id) {
        try {
            const response = await fetch(`${API_URL}?action=toggle_mute&id=${id}`, { method: 'POST' });
            const result = await response.json();
            if (result.success) {
                const idx = monitors.findIndex(m => m.id == id);
                if (idx !== -1) {
                    monitors[idx].is_muted = result.is_muted;
                    renderMonitors();
                }
            }
        } catch (error) {
            console.error('Erro ao alternar silenciamento:', error);
        }
    }

    async function checkNow(id) {
        if (!id) return;
        const btn = document.getElementById(`btn-check-${id}`);
        const icon = document.getElementById(`icon-check-${id}`);
        
        if (btn) btn.disabled = true;
        if (icon) icon.classList.add('fa-spin');

        try {
            await checkMonitor(id);
        } catch (e) {
            console.error('Erro ao realizar verificação manual:', e);
        } finally {
            if (icon) icon.classList.remove('fa-spin');
            if (btn) btn.disabled = false;
        }
    }

    async function checkMonitor(id) {
        try {
            const response = await fetch(`${API_URL}?action=check_monitor&id=${id}`);
            const result = await response.json();
            
            if (result.success) {
                const monitorIdx = monitors.findIndex(m => m.id == id);
                const oldStatus = monitors[monitorIdx].status;
                const newStatus = result.data.status;

                // Atualiza dados locais
                monitors[monitorIdx] = { ...monitors[monitorIdx], ...result.data };
                
                // Alerta sonoro se caiu (mudança para down), apenas se NÃO estiver silenciado
                if (oldStatus !== 'down' && newStatus === 'down') {
                    if (!monitors[monitorIdx].is_muted) {
                        playAlertSound();
                    }
                }

                updateMonitorCard(result.data);
                if (activeMonitorId == id) {
                    updateModalStats(monitors[monitorIdx]);
                    updateChart(id);
                }
                updateStats();
            }
        } catch (error) {
            console.error(`Falha no check do monitor ${id}:`, error);
        }
    }

    async function updateStats() {
        try {
            const response = await fetch(`${API_URL}?action=get_stats`);
            const result = await response.json();
            if (result.success) {
                const s = result.data;
                statTotal.textContent = s.total;
                statUp.textContent = s.up;
                statDown.textContent = s.down;
                statLatency.textContent = `${s.avg_latency} ms`;
            }
        } catch (error) {}
    }

    // --- Renderização e UI ---

    function renderMonitors() {
        if (monitors.length === 0) {
            monitorsList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-circle-nodes empty-icon"></i>
                    <p>Nenhum site monitorado ainda.</p>
                </div>`;
            return;
        }

        // Filtrar por termo de busca (Nome ou URL/Domínio)
        let list = monitors.slice();
        if (searchQuery) {
            list = list.filter(m => {
                const nameMatch = m.name && m.name.toLowerCase().includes(searchQuery);
                const urlMatch = m.url && m.url.toLowerCase().includes(searchQuery);
                return nameMatch || urlMatch;
            });
        }

        // Filtrar por categoria
        if (selectedCategoryFilter) {
            list = list.filter(m => {
                if (!m.categories) return false;
                const cats = m.categories.split(',').map(c => c.trim().toLowerCase());
                return cats.includes(selectedCategoryFilter.toLowerCase());
            });
        }

        // Ordenar lista
        if (currentSortMode === 'latency-desc') {
            list.sort((a, b) => (b.last_latency || 0) - (a.last_latency || 0));
        } else if (currentSortMode === 'latency-asc') {
            list.sort((a, b) => (a.last_latency || 0) - (b.last_latency || 0));
        } else if (currentSortMode === 'name-asc') {
            list.sort((a, b) => a.name.localeCompare(b.name));
        } else if (currentSortMode === 'status-down') {
            list.sort((a, b) => {
                if (a.status === 'down' && b.status !== 'down') return -1;
                if (a.status !== 'down' && b.status === 'down') return 1;
                return 0;
            });
        }

        if (list.length === 0) {
            const emptyMsg = searchQuery 
                ? `Nenhum site encontrado para "${searchQuery}".` 
                : `Nenhum site encontrado para a categoria "${selectedCategoryFilter}".`;
            monitorsList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-magnifying-glass-slash empty-icon"></i>
                    <p>${emptyMsg}</p>
                </div>`;
            return;
        }

        monitorsList.innerHTML = '';
        list.forEach(m => {
            const card = createMonitorCard(m);
            monitorsList.appendChild(card);
        });
    }

    function createMonitorCard(m) {
        const div = document.createElement('div');
        const isMuted = m.is_muted == 1;
        div.className = `monitor-card ${activeMonitorId == m.id ? 'active' : ''} ${isMuted ? 'muted-card' : ''}`;
        div.id = `monitor-card-${m.id}`;
        div.onclick = (e) => {
            if (!e.target.closest('.btn-icon')) selectMonitor(m.id);
        };

        const catsArray = m.categories ? m.categories.split(',').map(c => c.trim()).filter(Boolean) : [];
        const catsHtml = catsArray.length > 0
            ? `<div class="card-categories">${catsArray.map(c => `<span class="category-badge"><i class="fa-solid fa-tag"></i> ${c}</span>`).join('')}</div>`
            : '';

        div.innerHTML = `
            <div class="monitor-meta">
                <div class="status-indicator ${m.status || 'unknown'}" id="status-ind-${m.id}"></div>
                <div class="monitor-details">
                    <div class="monitor-name-row">
                        <span class="monitor-name">${m.name}</span>
                        ${isMuted ? '<i class="fa-solid fa-bell-slash muted-icon" title="Alertas silenciados para este site"></i>' : ''}
                        <span class="monitor-interval-tag">${m.check_interval}s</span>
                    </div>
                    <span class="monitor-url-text">${m.url}</span>
                    ${catsHtml}
                    <div class="monitor-stats-row">
                        <span><i class="fa-solid fa-clock-rotate-left"></i> <small id="last-check-${m.id}">${formatDate(m.last_check)}</small></span>
                        <span><i class="fa-solid fa-bolt"></i> <small class="latency-highlight" id="last-latency-${m.id}">${m.last_latency || 0}ms</small></span>
                    </div>
                </div>
            </div>
            <div class="monitor-actions">
                <button class="btn-icon check-now" id="btn-check-${m.id}" onclick="event.stopPropagation(); window.app_checkNow(${m.id})" title="Verificar Agora">
                    <i class="fa-solid fa-arrows-rotate" id="icon-check-${m.id}"></i>
                </button>
                <button class="btn-icon mute-toggle ${isMuted ? 'muted' : ''}" onclick="event.stopPropagation(); window.app_toggleMute(${m.id})" title="${isMuted ? 'Ativar alertas sonoros deste site' : 'Silenciar alertas sonoros deste site'}">
                    <i class="fa-solid ${isMuted ? 'fa-bell-slash' : 'fa-bell'}"></i>
                </button>
                <button class="btn-icon edit" onclick="event.stopPropagation(); window.app_edit(${m.id})" title="Editar Monitor">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn-icon delete" onclick="event.stopPropagation(); window.app_delete(${m.id})" title="Excluir">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        return div;
    }

    function updateMonitorCard(m) {
        const ind = document.getElementById(`status-ind-${m.id}`);
        const lastCheck = document.getElementById(`last-check-${m.id}`);
        const lastLat = document.getElementById(`last-latency-${m.id}`);
        
        if (ind) {
            ind.className = `status-indicator ${m.status}`;
        }
        if (lastCheck) lastCheck.textContent = formatDate(m.last_check);
        if (lastLat) lastLat.textContent = `${m.response_time_ms}ms`;
    }

    function selectMonitor(id) {
        activeMonitorId = id;
        window.activeMonitorId = id;
        
        // UI Feedback
        document.querySelectorAll('.monitor-card').forEach(c => c.classList.remove('active'));
        const card = document.getElementById(`monitor-card-${id}`);
        if (card) card.classList.add('active');
        
        const m = monitors.find(mon => mon.id == id);
        if (!m) return;

        if (modalMonitorName) modalMonitorName.innerHTML = `<i class="fa-solid fa-server"></i> ${m.name}`;
        if (modalMonitorUrl) {
            modalMonitorUrl.textContent = m.url;
            modalMonitorUrl.href = m.url;
        }

        updateModalStats(m);

        if (detailsModal) detailsModal.classList.remove('hidden');

        initOrUpdateChart(id);
    }

    function updateModalStats(m) {
        if (modalStatusBadge) {
            if (m.status === 'up') {
                modalStatusBadge.className = 'detail-value text-green';
                modalStatusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> ONLINE';
            } else if (m.status === 'down') {
                modalStatusBadge.className = 'detail-value text-red';
                modalStatusBadge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> OFFLINE';
            } else {
                modalStatusBadge.className = 'detail-value text-muted';
                modalStatusBadge.innerHTML = '<i class="fa-solid fa-circle-question"></i> PENDENTE';
            }
        }

        if (modalStatusCode) {
            const code = m.status_code || m.last_status_code;
            if (code) {
                modalStatusCode.textContent = `HTTP ${code}`;
            } else {
                modalStatusCode.textContent = m.status === 'up' ? 'HTTP 200 OK' : (m.status === 'down' ? 'Erro cURL / Timeout' : '--');
            }
        }

        if (modalLatencyValue) {
            const latency = (m.response_time_ms !== undefined) ? m.response_time_ms : (m.last_latency || 0);
            modalLatencyValue.textContent = `${latency} ms`;
        }

        if (modalIntervalValue) {
            modalIntervalValue.textContent = `${m.check_interval}s`;
        }

        if (modalCategoriesValue) {
            const cats = m.categories ? m.categories.split(',').map(c => c.trim()).filter(Boolean) : [];
            if (cats.length > 0) {
                modalCategoriesValue.innerHTML = cats.map(c => `<span class="category-badge"><i class="fa-solid fa-tag"></i> ${c}</span>`).join(' ');
            } else {
                modalCategoriesValue.innerHTML = '<span class="detail-value text-muted">Sem categorias</span>';
            }
        }

        if (modalLastCheck) {
            modalLastCheck.textContent = `Última checagem: ${formatDate(m.last_check)}`;
        }
    }

    function closeChart() {
        activeMonitorId = null;
        document.querySelectorAll('.monitor-card').forEach(c => c.classList.remove('active'));
        if (detailsModal) detailsModal.classList.add('hidden');
    }

    // --- Gráficos (Chart.js) ---

    async function initOrUpdateChart(id) {
        try {
            const response = await fetch(`${API_URL}?action=get_logs&id=${id}`);
            const result = await response.json();

            if (!result.success) return;

            const labels = result.data.map(log => log.created_at.split(' ')[1]); // Apenas HH:mm:ss
            const data = result.data.map(log => log.response_time_ms);
            const statusColors = result.data.map(log => log.success ? '#10b981' : '#ef4444');

            if (latencyChart) {
                latencyChart.data.labels = labels;
                latencyChart.data.datasets[0].data = data;
                latencyChart.data.datasets[0].pointBackgroundColor = statusColors;
                latencyChart.update('none');
            } else {
                const ctx = document.getElementById('latencyChart').getContext('2d');
                latencyChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Latência (ms)',
                            data: data,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointBackgroundColor: statusColors
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: '#1e293b',
                                titleColor: '#f8fafc',
                                bodyColor: '#94a3b8',
                                borderColor: '#334155',
                                borderWidth: 1
                            }
                        }
                    }
                });
            }
        } catch (error) {}
    }

    async function updateChart(id) {
        if (!latencyChart || activeMonitorId != id) return;
        initOrUpdateChart(id);
    }

    // --- Polling Management ---

    function setupPollings() {
        // Limpa pollings antigos que não estão mais na lista atual
        const currentIds = monitors.map(m => m.id.toString());
        Object.keys(pollIntervals).forEach(id => {
            if (!currentIds.includes(id)) {
                clearInterval(pollIntervals[id]);
                delete pollIntervals[id];
            }
        });

        // Cria novos pollings para monitores recém-adicionados ou reinicia
        monitors.forEach(m => {
            if (!pollIntervals[m.id]) {
                // Primeira checagem imediata se o status for desconhecido
                if (m.status === 'unknown') checkMonitor(m.id);

                pollIntervals[m.id] = setInterval(() => {
                    checkMonitor(m.id);
                }, m.check_interval * 1000);
            }
        });
    }

    // --- Áudio e Alertas (Web Audio API) ---

    function toggleSound() {
        isSoundMuted = !isSoundMuted;
        if (isSoundMuted) {
            toggleSoundBtn.classList.add('muted');
            soundStatusText.textContent = 'Mutados';
            soundIcon.className = 'fa-solid fa-volume-xmark sound-icon';
        } else {
            toggleSoundBtn.classList.remove('muted');
            soundStatusText.textContent = 'Ativos';
            soundIcon.className = 'fa-solid fa-volume-high sound-icon';
            
            // "Desbloqueia" o AudioContext no primeiro clique (requisito browsers)
            const dummyCtx = new (window.AudioContext || window.webkitAudioContext)();
            dummyCtx.resume();
        }
    }

    function playAlertSound() {
        if (isSoundMuted) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            
            // BIP 1
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, ctx.currentTime); // Nota Lá
            gain1.gain.setValueAtTime(0.1, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start();
            osc1.stop(ctx.currentTime + 0.5);

            // BIP 2 (Atrasado)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
            gain2.gain.setValueAtTime(0, ctx.currentTime);
            gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.3);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(ctx.currentTime + 0.3);
            osc2.stop(ctx.currentTime + 0.8);
        } catch (e) {
            console.error('Erro ao tocar som:', e);
        }
    }

    // --- Helpers ---

    function showLoading(show) {
        if (show) updateIndicator.classList.remove('hidden');
        else updateIndicator.classList.add('hidden');
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'Nunca';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('pt-BR');
    }

    // Torna funções acessíveis globalmente para os onclicks inline
    window.app_delete = deleteMonitor;
    window.app_toggleMute = toggleMute;
    window.app_checkNow = checkNow;
    window.app_edit = openEditModal;
    window.app_switchView = switchView;
});
