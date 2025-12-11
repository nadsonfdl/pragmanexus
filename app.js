// app.js

/**
 * ==========================================
 * CONFIGURAÇÃO GLOBAL E UTILITÁRIOS
 * ==========================================
 */

// Informações de Destino e API
const IGUT_API_BASE_URL = '.igutclinicas.com.br/aplicativos/info';

// NÚMERO DE SUPORTE CONECTADO AO CHATWOOT (italk.app.br) - Destino da mensagem para o Jair
const SUPORTE_WHATSAPP_NUMBER = '556196528955'; 

// URL Base da Planilha Google Sheets para dados EBA (PLACEHOLDER - Atualize se usar o EBA)
const EBA_DATA_URL = 'https://docs.google.com/sheets/d/e/2PACX-1vT-PLACEHOLDER/pub?gid=0&single=true&output=csv'; 

// 🚨 LINK ÚNICO (Lista de Clínicas + Dados de Serviços Adicionais)
// SEU LINK CORRIGIDO FOI IMPLEMENTADO AQUI.
const SERVICOS_ADICIONAIS_DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTKudTmmLjI7dXYSijEIsd5Jqak5wbc2dlP-5Z4Zz6ueDPG_bTy4WOhSAM7mNj_J1bKqwdPQTqsihIf/pub?output=csv'; 


/**
 * Lista de Clínicas EBA (Mantida apenas como fallback)
 */
const EBA_CLINIC_LIST = [
    "acolhedor", "anesprime", "anestesia", "anestesil", "anesthesio", "anextesia", "aqui", 
    "astesis", "bi", "bmw", "brunopaiva", "cacib", "care", "cliag", "clian", "clianest", 
    "clin", "coc", "coopanestce", "danielaagra", "dasa", "demo", "desenvolvimento", 
    "devices", "epm", "flug", "gaap", "gat", "guci", "hac", "hub", "kora", "koraanchieta", 
    "koracariacica", "korapalmas", "lessence", "modelo", "naianamelo", "novoebatest", 
    "oftalmonest", "painel", "patrof", "pedrotestee", "pfc", "producao", "prosafe", 
    "research", "riscos", "sab", "sael", "sagg", "saitg", "sanesth", "secan", "sedaa", 
    "sedazione", "sisb", "teste", "tk", "unianest", "vital", "wmc"
];


// --- Funções de Utilidade Compartilhadas ---

const toggleDashboardView = (isLoading) => {
    $('#loading').toggleClass('hidden', !isLoading);
    $('#dashboard').toggleClass('hidden', isLoading);
};

const populateSelect = (selectId, data) => {
    const select = $(`#${selectId}`);
    select.empty().append('<option></option>');
    
    data.forEach(item => {
        select.append(new Option(item, item));
    });
};

const showSection = (sectionId) => {
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
};

const fetchCsvData = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Falha ao buscar CSV em: ${url}. Status: ${response.status}`);
            return [];
        }
        const csvText = await response.text();

        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length <= 1) return [];

        const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const obj = {};
            headers.forEach((header, index) => {
                // Adicionando um tratamento para garantir que o cabeçalho não tenha caracteres escondidos
                const cleanHeader = header.replace(/\uFEFF/g, ''); 
                obj[cleanHeader] = (values[index] || '').replace(/"/g, '').trim(); 
            });
            data.push(obj);
        }
        return data;
    } catch (error) {
        console.error("Erro ao carregar dados do Sheets:", error);
        return [];
    }
};


/**
 * ==========================================
 * MÓDULO IGUT: LÓGICA ESPECÍFICA (VIA API + CSV)
 * ==========================================
 */
const IGUT_Module = (() => {
    let allServicosData = null; 
    let clinicListCache = null;

    // --- Funções de Requisição e Utilitários ---

    const fetchIgutData = async (clinicName) => {
        const url = `https://${clinicName}${IGUT_API_BASE_URL}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                // Retorna erro para o bloco catch tratar
                throw new Error(`Erro ao buscar dados: ${response.status}`);
            }
            return await response.json(); 
        } catch (error) {
            console.error("Falha na requisição IGUT:", error);
            // Retorna null em caso de falha da API
            return null;
        }
    };
    
    const getEnvironmentName = (hostname) => {
        if (!hostname) return { name: 'DESCONHECIDO', class: 'env-unknown' };
        
        hostname = hostname.toLowerCase();
        
        if (hostname.includes('igutalfa')) {
            return { name: 'ALFA', class: 'env-alfa' };
        } else if (hostname.includes('igutbeta')) {
            return { name: 'BETA', class: 'env-beta' };
        } else if (hostname.includes('igutmaster')) {
            return { name: 'MASTER', class: 'env-master' };
        }
        return { name: 'PADRÃO', class: 'env-unknown' };
    };

    // --- Funções de Formatação de Dados ---
    
    // Funções formatLicencas e formatInfoClinica (MANTIDAS)
    const formatLicencas = (data, clinicName) => {
        if (!data || !data.licencas || !data.contrato) return 'Dados de licenças e contrato não disponíveis.';
        
        const licencas = data.licencas;
        const contrato = data.contrato;
        
        const crmInUse = parseInt(licencas.CRM) || 0;
        const otherInUse = (parseInt(licencas.CRFA) || 0) + 
                           (parseInt(licencas.CRP) || 0) + 
                           (parseInt(licencas.SEM) || 0);

        const crmContracted = parseInt(contrato.qtd_licenca) || 0;
        const otherContracted = parseInt(contrato.qtd_licenca2) || 0;

        const crmCost = crmInUse * 100;
        const otherCost = otherInUse * 50;
        const totalEstimatedMonthlyCost = crmCost + otherCost;

        const crmUsagePercent = crmContracted > 0 ? (crmInUse / crmContracted) * 100 : 0;
        const crmUsageStatus = crmUsagePercent > 90 ? 'critical' : '';

        const otherUsagePercent = otherContracted > 0 ? (otherInUse / otherContracted) * 100 : 0;
        const otherUsageStatus = otherUsagePercent > 90 ? 'critical' : '';
        
        let html = `
            <h4>Situação de Uso e Contrato</h4>
            
            <div class="license-info-grid">
                <div class="usage-metric-card">
                    <div class="metric-header">
                        <h4>Licenças CRM</h4>
                        <span class="usage-percentage ${crmUsageStatus}">${crmUsagePercent.toFixed(1)}%</span>
                    </div>
                    <div class="usage-values">
                        Em Uso: <strong>${crmInUse}</strong> / Contratadas: <strong>${crmContracted}</strong>
                    </div>
                    <div class="usage-bar-container">
                        <div class="usage-bar-fill ${crmUsageStatus}" style="width: ${Math.min(crmUsagePercent, 100)}%;"></div>
                    </div>
                </div>

                <div class="usage-metric-card">
                    <div class="metric-header">
                        <h4>Demais Especialidades (CRFA, CRP, SEM)</h4>
                        <span class="usage-percentage ${otherUsageStatus}">${otherUsagePercent.toFixed(1)}%</span>
                    </div>
                    <div class="usage-values">
                        Em Uso: <strong>${otherInUse}</strong> / Contratadas: <strong>${otherContracted}</strong>
                    </div>
                    <div class="usage-bar-container">
                        <div class="usage-bar-fill ${otherUsageStatus}" style="width: ${Math.min(otherUsagePercent, 100)}%;"></div>
                    </div>
                </div>
            </div>
            
            <div class="total-cost-display">
                <i class="fas fa-hand-holding-usd"></i> Custo Mensal Estimado Total: 
                R$ ${totalEstimatedMonthlyCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
        `;
        return html;
    };


    const formatInfoClinica = (data) => {
        if (!data) return 'Dados operacionais não disponíveis.';
        
        const status = data.ip ? 'Online' : 'Inativo';
        const statusClass = status === 'Online' ? 'online' : 'offline';
        const environment = getEnvironmentName(data.hostname || data.ip);
        
        const clinico = data.clinico || {};
        const notas = data.notas || {};
        
        let html = `
            <div class="info-clinica-grid">
                
                <div class="data-box" style="animation-delay: 0.1s;">
                    <i class="fas fa-server"></i>
                    <h5>STATUS</h5>
                    <p>Servidor</p>
                    <span class="status-chip ${statusClass}">${status}</span>
                </div>

                <div class="data-box" style="animation-delay: 0.2s;">
                    <i class="fas fa-code-branch"></i>
                    <h5>AMBIENTE</h5>
                    <p>Banco de Dados</p>
                    <span class="status-chip ${environment.class}">${environment.name}</span>
                </div>

                <div class="data-box" style="animation-delay: 0.3s;">
                    <i class="fas fa-user-injured"></i>
                    <h5>TOTAL</h5>
                    <p>Pacientes</p>
                    <p>${(clinico.pacientes || 0).toLocaleString('pt-BR')}</p>
                </div>
                
                <div class="data-box" style="animation-delay: 0.4s;">
                    <i class="fas fa-calendar-check"></i>
                    <h5>TOTAL</h5>
                    <p>Consultas</p>
                    <p>${(clinico.consultas || 0).toLocaleString('pt-BR')}</p>
                </div>
                
                <div class="data-box" style="animation-delay: 0.5s;">
                    <i class="fas fa-file-invoice-dollar"></i>
                    <h5>MÉDIA</h5>
                    <p>Notas/Dia</p>
                    <p>${((parseInt(notas.mes1)||0 + parseInt(notas.mes2)||0 + parseInt(notas.mes3)||0) / 90).toFixed(1)}</p>
                </div>

                <div class="data-box" style="animation-delay: 0.6s;">
                    <i class="fas fa-notes-medical"></i>
                    <h5>PÓS-OP</h5>
                    <p>Receitas</p>
                    <p>${(data.receitas?.posop || 0).toLocaleString('pt-BR')}</p>
                </div>
            </div>
            
            <div class="info-details">
                <h4><i class="fas fa-hdd"></i> Detalhes Técnicos</h4>
                <p><strong>Hostname:</strong> ${data.hostname || 'N/A'}</p>
                <p><strong>IP:</strong> ${data.ip || 'N/A'}</p>
                <p><strong>Versão (API):</strong> ${data.versao || 'N/A'}</p>
            </div>
            
            <div class="info-details">
                <h4><i class="fas fa-chart-line"></i> Dados Recentes</h4>
                <p><strong>Pre-operatórios:</strong> ${clinico.preops || 0}</p>
                <p><strong>Pós-operatórios (Clínico):</strong> ${clinico.posops || 0}</p>
                <p><strong>Notas Mês 1 / Mês 2 / Mês 3:</strong> ${notas.mes1 || 0} / ${notas.mes2 || 0} / ${notas.mes3 || 0}</p>
            </div>
        `;

        return html;
    };


    /** Função de Formatação de Serviços Adicionais (CSV) - Restaurada para 18 Colunas */
    const formatServicosAdicionais = (selectedClinic) => {
        if (!allServicosData) {
            return '<p>Carregando dados de serviços adicionais...</p>';
        }

        const clinicData = allServicosData.find(c => c.CLINICA_ID && c.CLINICA_ID.toLowerCase() === selectedClinic.toLowerCase());

        if (!clinicData) {
            return `<p>Nenhum serviço adicional encontrado na planilha para a clínica <strong>${selectedClinic}</strong>.</p>`;
        }
        
        // --- 1. DETALHES DE INFRAESTRUTURA (6 Colunas de Metadados) ---

        let integrationHtml = '';
        
        // a. iTalk BOT
        const italkBot = clinicData.ITALK_BOT || 'NÃO TEM';
        const italkBotClass = italkBot.toUpperCase() === 'SIM' ? 'success' : 'danger';
        integrationHtml += `
            <div class="detail-box">
                <h5>iTALK BOT</h5>
                <p>Status:</p>
                <span class="detail-status-chip ${italkBotClass}">${italkBot}</span>
            </div>`;

        // b. iTalk CONEXÃO
        const italkConexao = clinicData.ITALK_CONEXAO || 'N/A';
        const italkConexaoClass = italkConexao.toUpperCase() === 'OFICIAL' ? 'success' : 'warning';
        integrationHtml += `
            <div class="detail-box">
                <h5>CONEXÃO</h5>
                <p>${italkConexao}</p>
                <span class="detail-status-chip ${italkConexaoClass}">Tipo</span>
            </div>`;

        // c. iTalk USO
        const italkUso = clinicData.ITALK_USO || 'N/A';
        integrationHtml += `
            <div class="detail-box">
                <h5>USO</h5>
                <p>${italkUso}</p>
            </div>`;
        
        // d. Painel de Senhas LINK
        const painelLink = clinicData.PAINEL_SENHAS_LINK || 'NÃO TEM';
        const painelLinkClass = painelLink.toUpperCase().includes('NÃO TEM') ? 'danger' : 'success';
        integrationHtml += `
            <div class="detail-box">
                <h5>PAINEL DE SENHAS</h5>
                <p>${painelLink.toUpperCase().includes('NÃO TEM') ? 'Link Não Registrado' : `<a href="${painelLink}" target="_blank">Acessar Link</a>`}</p>
                <span class="detail-status-chip ${painelLinkClass}">${painelLink.toUpperCase().includes('NÃO TEM') ? 'Desativado' : 'Link Ativo'}</span>
            </div>`;
            
        // e. Totem de Senhas
        const totemSenhas = clinicData.TOTEM_SENHAS || 'N/A';
        const totemSenhasClass = totemSenhas.toUpperCase().includes('IGUT') ? 'success' : 'warning';
        integrationHtml += `
            <div class="detail-box">
                <h5>TOTEM</h5>
                <p>${totemSenhas}</p>
                <span class="detail-status-chip ${totemSenhasClass}">Tipo de Totem</span>
            </div>`;
            
        // f. Integração WhatsApp
        const integracaoWa = clinicData.INTEGRACAO_WHATSAPP || 'NENHUMA';
        const integracaoWaClass = integracaoWa.toUpperCase().includes('ITALK') ? 'success' : (integracaoWa.toUpperCase().includes('NENHUMA') ? 'danger' : 'warning');
        integrationHtml += `
            <div class="detail-box">
                <h5>INTEGRAÇÃO WA</h5>
                <p>${integracaoWa}</p>
                <span class="detail-status-chip ${integracaoWaClass}">Plataforma</span>
            </div>`;
            
        // --- 2. LISTA DE SERVIÇOS ATIVOS (9 Colunas SERVICO_ SIM/NAO) ---
        // Lógica restaurada para buscar os 9 serviços SIM/NAO
        let servicesHtml = '<h4>Serviços Ativos:</h4><ul class="service-list">';

        let foundServices = false;
        // As 9 colunas SERVICO_ são restauradas aqui:
        const servicosKeys = [
            'SERVICO_PAINEL_SENHAS', 'SERVICO_IGUT_SIGN', 'SERVICO_IGUT_DICOM', 'SERVICO_IGUT_IA',
            'SERVICO_ITALK', 'SERVICO_CRM_IGUT', 'SERVICO_ASSISTENTE_IA', 'SERVICO_SITES_PROF',
            'SERVICO_IGUT_FATURE'
        ];
        
        for (const key of servicosKeys) {
            if (clinicData[key] && clinicData[key].toUpperCase() === 'SIM') {
                const serviceName = key.replace('SERVICO_', '').replace(/_/g, ' ');
                servicesHtml += `<li><i class="fas fa-check-circle service-active"></i> ${serviceName}</li>`;
                foundServices = true;
            }
        }
        
        if (!foundServices) {
            servicesHtml += '<li><i class="fas fa-times-circle service-inactive"></i> Nenhum serviço adicional SIM/NAO ativo registrado.</li>';
        }
        
        servicesHtml += '</ul>';

        // --- 3. DETALHES FINANCEIROS ---
        
        let financialHtml = '';
        if (clinicData.DATA_CONTRATO_SA || clinicData.VALOR_SA) {
            financialHtml += '<div class="info-details">';
            financialHtml += `<h4><i class="fas fa-dollar-sign"></i> Detalhes Financeiros</h4>`;
            financialHtml += `<p><strong>Data de Contrato:</strong> ${clinicData.DATA_CONTRATO_SA || 'N/A'}</p>`;
            financialHtml += `<p><strong>Valor Estimado:</strong> R$ ${clinicData.VALOR_SA || 'N/A'}</p>`;
            financialHtml += '</div>';
        }


        // --- 4. MONTAGEM FINAL ---
        return `
            <div class="integration-container">
                <h4><i class="fas fa-project-diagram"></i> Infraestrutura de Comunicação e Senhas</h4>
                <div class="integration-details-grid">${integrationHtml}</div>
            </div>
            
            ${servicesHtml}
            ${financialHtml}
        `;
    };
    
    // --- Funções de Controle da Modal e Submissão (MANTIDAS) ---

    const openModal = (clinicName) => {
        $('#clinicNameDisplay').text(`Clínica: ${clinicName}`);
        $('#medicDataFields').removeClass('hidden'); 
        $('#dadosSelect').val('COMPLETO');
        $('#licenseForm')[0].reset(); 
        $('#licenseModal').removeClass('hidden');
    };
    
    const closeModal = () => { $('#licenseModal').addClass('hidden'); };

    const toggleMedicDataFields = (hasData) => { 
        const fields = $('#medicDataFields').find('input, select');
        if (hasData) {
            $('#medicDataFields').removeClass('hidden');
            fields.prop('required', true); 
        } else {
            $('#medicDataFields').addClass('hidden');
            fields.prop('required', false).val(''); 
        }
    };
    
    const generateWhatsAppMessage = (clinicName, form) => {
        const qtd = form.qtdLicenca.value;
        const tipo = form.tipoLicenca.value;
        const dadosOpcao = form.dadosSelect.value;
        
        let message = `*Olá, Jair! Nova solicitação de licença via PragmaNexus:*\n\n`;
        message += `*Clínica:* ${clinicName}\n`;
        message += `*Tipo de Licença:* ${tipo === 'CRM' ? 'CRM (R$ 100)' : 'Demais Especialidades (R$ 50)'}\n`;
        message += `*Quantidade:* ${qtd}\n`;
        
        if (dadosOpcao === 'COMPLETO') {
            const conselhoTipo = form.conselhoTipo.value || 'N/A';
            const conselhoUF = form.conselhoUF.value.toUpperCase() || 'N/A';
            
            message += `\n*DADOS DO PROFISSIONAL:*\n`;
            message += `Nome: ${form.medicName.value || 'N/A'}\n`;
            message += `CPF: ${form.medicCPF.value || 'N/A'}\n`;
            message += `Conselho: ${conselhoTipo} / UF: ${conselhoUF} / Número: ${form.conselhoNum.value || 'N/A'}\n`;
        } else {
            message += `\n*STATUS:* Dados do profissional pendentes. (Solicitar apenas as licenças para reserva)\n`;
        }

        message += `\n*Aguardando sua confirmação para adição e ajuste na cobrança.*`;
        
        return encodeURIComponent(message);
    };
    
    const handleFormSubmission = (e) => {
        e.preventDefault();
        
        const selectedClinic = $('#clinicSelect').val();
        if (!selectedClinic) {
            alert('Erro: Selecione a clínica no dashboard antes de solicitar.');
            closeModal();
            return;
        }

        const encodedMessage = generateWhatsAppMessage(selectedClinic, e.target);
        const whatsappUrl = `https://wa.me/${SUPORTE_WHATSAPP_NUMBER}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
        closeModal();
    };
    
    // --- Funções do Dashboard ---

    const updateDashboardUI = (data, selectedClinic) => {
        // 1. Preenche Licenças
        $('#licencas-section .card-content').html(formatLicencas(data, selectedClinic));
        // 2. Preenche Info. Clínica
        $('#info-clinica-section #info-clinica-content').html(formatInfoClinica(data));
        // 3. Preenche Serviços Adicionais
        $('#servicos-adicionais-section #servicos-adicionais-content').html(formatServicosAdicionais(selectedClinic));
        
        // Exibe o Dashboard
        toggleDashboardView(false);
    };
    
    /** Handler principal do botão de busca IGUT. */
    const handleIgutSearch = async () => {
        const selectedClinic = $('#clinicSelect').val();
        if (!selectedClinic) {
            alert('Por favor, selecione uma clínica.');
            return;
        }

        // Mostra o spinner de carregamento
        toggleDashboardView(true);
        
        // Garante que os dados de serviços estejam carregados
        if (!allServicosData) {
             allServicosData = await fetchCsvData(SERVICOS_ADICIONAIS_DATA_URL);
        }
        
        // Busca dados da API principal
        const data = await fetchIgutData(selectedClinic);
        
        if (data) {
            // SUCESSO: Carrega todos os dados e exibe o dashboard na seção de licenças
            updateDashboardUI(data, selectedClinic);
            showSection('licencas-section');
        } else {
            // FALHA DA API: Carrega apenas os dados da planilha e exibe o dashboard.
            let fallbackContent = `<p style="color: red; font-weight: bold;">⚠️ Erro ao conectar à API da clínica. Os dados dinâmicos (Licenças, Info. Clínica) não puderam ser carregados.</p>`;
            
            // Preenche o card de Licenças com a mensagem de erro
            $('#licencas-section .card-content').html(fallbackContent);
            $('#info-clinica-section #info-clinica-content').html(fallbackContent);
            
            // Tenta carregar os Serviços Adicionais da planilha (que já foi carregada)
            if (allServicosData) {
                $('#servicos-adicionais-section #servicos-adicionais-content').html(formatServicosAdicionais(selectedClinic));
                showSection('servicos-adicionais-section'); 
            } else {
                $('#servicos-adicionais-section #servicos-adicionais-content').html(fallbackContent);
            }
            
            // Esconde o spinner e exibe o dashboard com os dados parciais/erros
            toggleDashboardView(false);
        }
    };
    
    /** Inicializa o Módulo IGUT e configura Listeners. */
    const init = async () => { 
        
        // 1. Carregar TODOS os dados de SERVIÇOS/CLÍNICAS do Sheets (Fonte Única)
        allServicosData = await fetchCsvData(SERVICOS_ADICIONAIS_DATA_URL);
        
        // 2. Extrair Lista de Clínicas para o Select2
        if (allServicosData.length > 0 && allServicosData[0].CLINICA_ID) {
            // Usa Set para obter IDs únicos e depois ordena
            clinicListCache = [...new Set(allServicosData.map(item => item.CLINICA_ID))].sort();
        } else {
            console.error("Falha ao carregar dados de clínicas e serviços. Verifique a estrutura da planilha.");
            clinicListCache = []; 
        }

        $('#clinicSelect').select2({ placeholder: '-- Escolha uma clínica --', allowClear: true });
        populateSelect('clinicSelect', clinicListCache); 
        
        // Listeners para Botões e Navegação (MANTIDOS)
        $('#buscarBtn').on('click', handleIgutSearch);
        
        $('#openLicenseModalBtn').on('click', function() {
            const selectedClinic = $('#clinicSelect').val();
            if (!selectedClinic) {
                alert('Selecione uma clínica para continuar.');
                return;
            }
            openModal(selectedClinic);
        });
        $('.close-btn, .modal-overlay').on('click', function(e) {
            if (e.target.classList.contains('close-btn') || e.target.classList.contains('modal-overlay')) {
                closeModal();
            }
        });
        $('#dadosSelect').on('change', function() {
            const hasData = $(this).val() === 'COMPLETO';
            toggleMedicDataFields(hasData);
        }).trigger('change');
        $('#licenseForm').on('submit', handleFormSubmission);
        
        $('.dashboard-nav .nav-item').on('click', function(e) {
            e.preventDefault();
            $('.dashboard-nav .nav-item').removeClass('active');
            $(this).addClass('active');
            const sectionId = $(this).attr('href').substring(1) + '-section'; 
            showSection(sectionId);
        });
        
        // NOTA: O dashboard SÓ é exibido após o clique no botão Buscar.
        // O init apenas carrega as listas e espera a interação do usuário.
    };

    return { init };
})();

/**
 * ==========================================
 * MÓDULO EBA: LÓGICA ESPECÍFICA (VIA CSV)
 * ==========================================
 * (MANTIDO)
 */
const EBA_Module = (() => {
    let allEbaData = [];

    const fetchEbaData = async () => {
        allEbaData = await fetchCsvData(EBA_DATA_URL);
        return allEbaData;
    };
    
    const formatData = (data, section) => { return 'Dados do EBA...'; };
    const updateDashboardUI = (data) => { /* ... */ };

    const init = async () => {
        $('#clinicSelect').select2({ placeholder: '-- Escolha uma clínica --', allowClear: true });
        await fetchEbaData(); 
        const clinicIds = allEbaData.map(c => c.ID_CLINICA);
        populateSelect('clinicSelect', clinicIds.length > 0 ? clinicIds : EBA_CLINIC_LIST);
    };

    return { init };
})();


/**
 * 4. ROUTER / INICIALIZADOR GLOBAL
 */
$(document).ready(function() {
    const bodyId = document.body.id;

    if (bodyId === 'dashboard-igut') {
        IGUT_Module.init();
        console.log("Aplicação IGUT iniciada.");
    } else if (bodyId === 'dashboard-eba') {
        // EBA_Module.init(); 
        console.log("Aguardando inicialização completa do módulo EBA.");
    } else {
        console.log("Sistema PragmaNexus Hub/Área de Serviços carregado.");
    }
});