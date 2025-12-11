// area51_script.js

$(document).ready(function() {
    
    // Lista de Clínicas de TESTE (Substitua por uma URL CSV real se necessário)
    const MOCK_CLINIC_LIST = [
        "acolhedor", "otorrinodf", "clinicafluxus", "advance", "demo"
    ];
    
    // URL base da API (reuso do conceito IGUT)
    const API_BASE_URL = '.igutclinicas.com.br/aplicativos/info'; 
    
    // --- FUNÇÕES UTILITÁRIAS ---

    const populateSelect = (data) => {
        const select = $('#clinicSelect');
        select.empty().append('<option></option>');
        
        data.forEach(item => {
            select.append(new Option(item, item));
        });
        select.select2();
    };

    /** Função principal para simular ações de suporte e exibir resultados. */
    const executeSupportAction = (actionId, clinicId) => {
        const resultBox = $(`#result-${actionId}`);
        resultBox.removeClass().addClass('result-box loading').text('Executando...');
        
        // Simulação de tempo de espera (2 segundos)
        setTimeout(() => {
            let result = '';
            let statusClass = 'success'; 

            switch (actionId) {
                case 'pingApi':
                    // Simula sucesso/falha baseada na clínica
                    if (clinicId === 'demo') {
                        result = `Resposta da API: 404 NOT FOUND. (Host: ${clinicId}${API_BASE_URL})`;
                        statusClass = 'danger';
                    } else {
                        result = `Resposta da API em 45ms. Status: 200 OK. (Host: ${clinicId}${API_BASE_URL})`;
                    }
                    break;

                case 'checkDB':
                    result = `Versão MySQL: 8.0.35. Último restart: 2 dias atrás.`;
                    break;
                
                case 'fetchLogs':
                    // Simula um link de logs
                    result = `Logs disponíveis. <a href="http://logs.${clinicId}.pragmanexus.com.br" target="_blank">Abrir link</a>`;
                    statusClass = 'warning';
                    break;

                case 'clearCache':
                    result = `Cache do Chatwoot (iTalk) limpo com sucesso para ${clinicId}.`;
                    break;

                case 'testWebhook':
                    result = `Webhook OK. Latência: 120ms. Webhook: https://api.igut.com/wa-hook/${clinicId}`;
                    break;
                
                case 'restartService':
                    result = `Comando de reinicialização enviado para o servidor de integração de ${clinicId}.`;
                    statusClass = 'danger'; // Ações de restart são classificadas como perigo/atenção
                    break;

                default:
                    result = 'Ação desconhecida.';
                    statusClass = 'warning';
            }

            resultBox.removeClass('loading').addClass(statusClass).html(result);

        }, 2000); 
    };

    // --- INICIALIZAÇÃO ---

    // Popula o seletor de clínicas
    populateSelect(MOCK_CLINIC_LIST);

    // --- EVENT HANDLERS ---
    
    $('.action-btn').on('click', function() {
        const clinicId = $('#clinicSelect').val();
        const actionId = $(this).data('action-id');

        if (!clinicId) {
            alert('Por favor, selecione uma CLÍNICA ALVO antes de executar a ação.');
            return;
        }

        executeSupportAction(actionId, clinicId);
    });

});