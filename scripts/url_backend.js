// const URL_BASE = "http://localhost:4879";
// const URL_BASE = "https://pasv1jt1ca.execute-api.us-east-1.amazonaws.com/prod";
// const URL_BASE = "https://a9k3tn8ng7.execute-api.us-east-1.amazonaws.com/";
const URL_BASE = "https://5fd53e167e.execute-api.us-east-2.amazonaws.com/prod";

const LANGUAGES = ["pt", "en", "zh"];
const LANGUAGE_LOCALES = { pt: "pt-BR", en: "en", zh: "zh-CN" };
const LANGUAGE_TRANSLATION_INDEX = { en: 0, zh: 2 };
const LANGUAGE_STORAGE_KEY = "qb_language";
const LANGUAGE_STRINGS = {
    "Experimento · AWS Braket": ["Experiment · AWS Braket", "Experimento · AWS Braket", "实验 · AWS Braket"],
    "Batalha Naval Quântica": ["Quantum Battleship", "Batalla Naval Cuántica", "量子战舰"],
    "Experimento": ["Experiment", "Experimento", "实验"], "Análise": ["Analytics", "Análisis", "分析"], "Ranking": ["Leaderboard", "Clasificación", "排行榜"], "Referências": ["References", "Referencias", "参考资料"],
    "Referências científicas": ["Scientific references", "Referencias científicas", "科学参考资料"], "Conheça as especificações do hardware": ["View hardware specifications", "Ver especificaciones del hardware", "查看硬件规格"],
    "Computadores quânticos": ["Quantum computers", "Computadores cuánticos", "量子计算机"], "Íons aprisionados": ["Trapped ions", "Iones atrapados", "离子阱"], "Supercondutor": ["Superconducting", "Superconductor", "超导"], "Átomos neutros": ["Neutral atoms", "Átomos neutros", "中性原子"],
    "Participar do experimento": ["Join the experiment", "Participar en el experimento", "参加实验"], "Digite seu nome:": ["Enter your name:", "Escribe tu nombre:", "输入姓名："], "Seu nome": ["Your name", "Tu nombre", "你的姓名"], "Digite seu nome": ["Enter your name", "Escribe tu nombre", "输入姓名"],
    "Este jogo é um": ["This game is a", "Este juego es un", "本游戏是一项"], "experimento científico": ["scientific experiment", "experimento científico", "科学实验"], "e, ao final, você receberá uma análise": ["and you will receive an analysis", "y al final recibirás un análisis", "结束后你将收到分析"], "referente aos números produzidos nesta partida.": ["of the numbers produced in this match.", "de los números producidos en esta partida.", "关于本局产生的数字。"], "Na v0, os dados são sintéticos.": ["In v0, the data are synthetic.", "En la v0, los datos son sintéticos.", "在 v0 中，数据为合成数据。"], "Para isso, é importante jogar a partida até o final. Deseja continuar?": ["Please finish the match to contribute its data. Continue?", "Para aportar datos, termina la partida. ¿Quieres continuar?", "请完成对局以贡献数据。是否继续？"],
    "Jogar": ["Play", "Jugar", "开始"], "Abandonar Partida": ["Leave match", "Abandonar partida", "放弃对局"], "Jogadores": ["Players", "Jugadores", "玩家"],
    "Configuração da partida": ["Match setup", "Configuración de la partida", "对局设置"], "Escolha o hardware, o tabuleiro e a frota": ["Choose hardware, board and fleet", "Elige hardware, tablero y flota", "选择硬件、棋盘和舰队"], "Hardware · tabuleiro · frota": ["Hardware · board · fleet", "Hardware · tablero · flota", "硬件 · 棋盘 · 舰队"], "Tabuleiro": ["Board", "Tablero", "棋盘"],
    "Tarifa e faixa estimada · AWS Braket": ["Estimated AWS Braket price range", "Tarifa y rango estimado · AWS Braket", "AWS Braket 价格估算范围"], "Estimativa de custo no hardware quântico selecionado": ["Estimated cost for selected quantum hardware", "Costo estimado del hardware cuántico seleccionado", "所选量子硬件的预计费用"], "Selecione um hardware para calcular a tarifa.": ["Select hardware to calculate the tariff.", "Selecciona hardware para calcular la tarifa.", "选择硬件以计算费用。"],
    "Navios": ["Ships", "Barcos", "舰船"], "1 navio": ["1 ship", "1 barco", "1 艘舰船"], "2 navios": ["2 ships", "2 barcos", "2 艘舰船"], "3 navios": ["3 ships", "3 barcos", "3 艘舰船"], "4 navios": ["4 ships", "4 barcos", "4 艘舰船"], "5 navios": ["5 ships", "5 barcos", "5 艘舰船"], "6 navios": ["6 ships", "6 barcos", "6 艘舰船"], "7 navios": ["7 ships", "7 barcos", "7 艘舰船"], "8 navios": ["8 ships", "8 barcos", "8 艘舰船"], "9 navios": ["9 ships", "9 barcos", "9 艘舰船"], "10 navios": ["10 ships", "10 barcos", "10 艘舰船"], "11 navios": ["11 ships", "11 barcos", "11 艘舰船"], "12 navios": ["12 ships", "12 barcos", "12 艘舰船"],
    "Ativar modo de jogo difícil": ["Enable hard mode", "Activar modo difícil", "开启困难模式"], "Desativar modo de jogo difícil": ["Disable hard mode", "Desactivar modo difícil", "关闭困难模式"], "Ativar ajuda clássica Plus": ["Enable Plus classical assistance", "Activar ayuda clásica Plus", "启用 Plus 经典辅助"], "Desativar ajuda clássica Plus": ["Disable Plus classical assistance", "Desactivar ayuda clásica Plus", "关闭 Plus 经典辅助"], "Jogo Difícil:": ["Hard mode:", "Modo difícil:", "困难模式："], "Quando selecionado, o computador quântico terá ajuda de um computador clássico para afundar navios.": ["When selected, the quantum computer will be assisted by a classical computer to sink ships.", "Cuando se seleccione, el computador cuántico contará con la ayuda de un computador clásico para hundir barcos.", "选中后，量子计算机将借助经典计算机击沉舰船。"],
    "Iniciar partida": ["Start match", "Iniciar partida", "开始对局"], "Encerrar partida": ["End match", "Finalizar partida", "结束对局"], "Entrar na fila": ["Join queue", "Entrar en la cola", "加入队列"], "Partida": ["Match", "Partida", "对局"], "Painel da partida": ["Match panel", "Panel de partida", "对局面板"], "Computador quântico e jogador": ["Quantum computer and player", "Computador cuántico y jugador", "量子计算机与玩家"], "Circuitos quântico e clássico": ["Quantum and classical circuits", "Circuitos cuántico y clásico", "量子与经典电路"], "Circuito da partida": ["Match circuit", "Circuito de la partida", "对局电路"], "Chip clássico de busca": ["Classical search chip", "Chip clásico de búsqueda", "经典搜索芯片"],
    "Pronto para jogar": ["Ready to play", "Listo para jugar", "准备就绪"], "Sua vez de atacar!": ["Your turn to attack!", "¡Tu turno para atacar!", "轮到你攻击！"], "Esperando ataque quântico...": ["Waiting for quantum attack...", "Esperando el ataque cuántico...", "等待量子攻击…"], "Coordenada": ["Coordinate", "Coordenada", "坐标"], "Digite a coordenada (ex: A5)": ["Enter a coordinate (e.g. A5)", "Escribe una coordenada (p. ej. A5)", "输入坐标（例如 A5）"], "Atacar": ["Attack", "Atacar", "攻击"],
    "Sua frota": ["Your fleet", "Tu flota", "你的舰队"], "Nenhuma partida ativa": ["No active match", "No hay una partida activa", "当前没有进行中的对局"], "Tabuleiro do jogador": ["Player board", "Tablero del jugador", "玩家棋盘"], "Tabuleiro adversário": ["Opponent board", "Tablero del oponente", "对手棋盘"], "Frota adversária": ["Opponent fleet", "Flota del oponente", "对手舰队"], "Frota indisponível nesta partida": ["Fleet unavailable for this match", "Flota no disponible en esta partida", "本局舰队信息不可用"], "Navio afundado": ["Ship sunk", "Barco hundido", "舰船已击沉"], "Navio em combate": ["Ship in combat", "Barco en combate", "舰船作战中"],
    "Voltar ao jogo": ["Back to game", "Volver al juego", "返回游戏"], "Análise dos computadores": ["Computer analysis", "Análisis de computadores", "计算机分析"], "Análise de hardware · Batalha Naval Quântica": ["Hardware analysis · Quantum Battleship", "Análisis de hardware · Batalla Naval Cuántica", "硬件分析 · 量子战舰"], "Batalha Naval Quântica / Dados": ["Quantum Battleship / Data", "Batalla Naval Cuántica / Datos", "量子战舰 / 数据"], "Computador": ["Computer", "Computador", "计算机"], "Todos os tabuleiros": ["All boards", "Todos los tableros", "所有棋盘"],
    "Resumo da amostra": ["Sample summary", "Resumen de la muestra", "样本摘要"], "Ataques quânticos": ["Quantum attacks", "Ataques cuánticos", "量子攻击"], "Partidas incluídas": ["Included matches", "Partidas incluidas", "纳入的对局"], "Entropia empírica": ["Empirical entropy", "Entropía empírica", "经验熵"], "Min-entropia empírica": ["Empirical min-entropy", "Min-entropía empírica", "经验最小熵"], "Entropia / baseline": ["Entropy / baseline", "Entropía / referencia", "熵 / 基准"], "Min-entropia empírica · grade 16 × 16": ["Empirical min-entropy · 16 × 16 grid", "Min-entropía empírica · cuadrícula 16 × 16", "经验最小熵 · 16 × 16 网格"],
    "Métricas do protocolo de aleatoriedade": ["Randomness protocol metrics", "Métricas del protocolo de aleatoriedad", "随机性协议指标"], "Referência: XEB e entropia certificada": ["Reference: XEB and certified entropy", "Referencia: XEB y entropía certificada", "参考：XEB 与认证熵"], "XEB do artigo": ["Paper XEB", "XEB del artículo", "论文中的 XEB"], "Não calculável": ["Not calculable", "No calculable", "无法计算"], "Tempo médio de amostra (tQC)": ["Average sample time (tQC)", "Tiempo medio por muestra (tQC)", "平均采样时间（tQC）"], "Não disponível": ["Unavailable", "No disponible", "不可用"], "Min-entropia certificada": ["Certified min-entropy", "Min-entropía certificada", "认证最小熵"], "Não certificada": ["Not certified", "No certificada", "未认证"],
    "Distribuições observadas nas partidas": ["Observed match distributions", "Distribuciones observadas en las partidas", "对局观测分布"], "Resultados observados": ["Observed results", "Resultados observados", "观测结果"], "Ataques quânticos arquivados; busca clássica excluída": ["Archived quantum attacks; classical search excluded", "Ataques cuánticos archivados; búsqueda clásica excluida", "已归档的量子攻击；不含经典搜索"], "Distribuição de Hamming": ["Hamming distribution", "Distribución de Hamming", "汉明重量分布"], "Número de bits 1 por coordenada quântica": ["Number of 1 bits per quantum coordinate", "Número de bits 1 por coordenada cuántica", "每个量子坐标中的 1 位数"], "Peso de Hamming normalizado": ["Normalized Hamming weight", "Peso de Hamming normalizado", "归一化汉明重量"], "Fração de bits 1 em relação à largura de cada tabuleiro": ["Fraction of 1 bits relative to each board width", "Fracción de bits 1 respecto al ancho de cada tablero", "相对于棋盘宽度的 1 位比例"], "Frequência de bit 1": ["Bit-1 frequency", "Frecuencia de bit 1", "1 位频率"], "Marginal observada em cada qubit": ["Observed marginal for each qubit", "Marginal observada en cada qubit", "各量子位的观测边缘分布"], "Posição relativa observada": ["Observed relative position", "Posición relativa observada", "观测相对位置"], "Linha e coluna normalizadas; esperado ponderado pelo tamanho": ["Normalized row and column; expected values weighted by board size", "Fila y columna normalizadas; esperado ponderado por tamaño", "归一化行列；期望值按棋盘大小加权"], "Entropia por qubit": ["Entropy per qubit", "Entropía por qubit", "每个量子位的熵"], "Shannon empírica, em bits": ["Empirical Shannon entropy, in bits", "Entropía de Shannon empírica, en bits", "经验香农熵（比特）"], "Entropia relativa por tabuleiro": ["Relative entropy per board", "Entropía relativa por tablero", "每种棋盘的相对熵"], "Shannon observada / máximo possível para cada tamanho": ["Observed Shannon / maximum possible for each size", "Shannon observada / máximo posible para cada tamaño", "观测香农熵 / 各尺寸最大值"], "Frequência por casa": ["Frequency per cell", "Frecuencia por casilla", "每格频率"], "Observado e esperado sob distribuição uniforme": ["Observed and expected under a uniform distribution", "Observado y esperado bajo distribución uniforme", "均匀分布下的观测值与期望值"], "Uniformidade por tabuleiro": ["Uniformity per board", "Uniformidad por tablero", "每种棋盘的均匀性"], "χ² por grau de liberdade; referência descritiva = 1": ["χ² per degree of freedom; descriptive reference = 1", "χ² por grado de libertad; referencia descriptiva = 1", "每自由度 χ²；描述性参考值 = 1"],
    "Medições brutas indisponíveis nesta versão da partida.": ["Raw measurements are unavailable for this match version.", "Las mediciones brutas no están disponibles en esta versión de la partida.", "此版本对局没有原始测量数据。"], "Medições brutas": ["Raw measurements", "Mediciones brutas", "原始测量"], "Repetições": ["Repeats", "Repeticiones", "重复次数"], "Esperado por célula": ["Expected per cell", "Esperado por casilla", "每格期望值"], "χ² (descritivo)": ["χ² (descriptive)", "χ² (descriptivo)", "χ²（描述性）"], "Graus de liberdade": ["Degrees of freedom", "Grados de libertad", "自由度"], "Entropia (bits)": ["Entropy (bits)", "Entropía (bits)", "熵（比特）"], "Entropia máxima (bits)": ["Maximum entropy (bits)", "Entropía máxima (bits)", "最大熵（比特）"], "Correlação lag 1": ["Lag-1 correlation", "Correlación lag 1", "滞后 1 相关性"], "Indisponível": ["Unavailable", "No disponible", "不可用"], "Frequências esperadas baixas: aproximação χ² inadequada.": ["Low expected frequencies: χ² approximation is unsuitable.", "Frecuencias esperadas bajas: la aproximación χ² no es adecuada.", "期望频数较低：χ² 近似不适用。"],
    "Baixar certificado PNG": ["Download PNG certificate", "Descargar certificado PNG", "下载 PNG 证书"], "Preparando certificado...": ["Preparing certificate...", "Preparando certificado...", "正在生成证书…"], "Baixar dados JSON": ["Download JSON data", "Descargar datos JSON", "下载 JSON 数据"], "Nova partida": ["New match", "Nueva partida", "新对局"], "Não foi possível capturar a imagem. Tente novamente ou baixe os dados JSON.": ["Could not capture the image. Try again or download the JSON data.", "No se pudo capturar la imagen. Inténtalo de nuevo o descarga los datos JSON.", "无法截取图片。请重试或下载 JSON 数据。"], "Registro de partida": ["Match record", "Registro de partida", "对局记录"], "Você venceu!": ["You won!", "¡Has ganado!", "你赢了！"], "O computador venceu!": ["The computer won!", "¡El computador ganó!", "计算机获胜！"], "Partida concluída sem vencedor.": ["Match ended without a winner.", "Partida finalizada sin ganador.", "对局结束，无胜者。"],
    "Dificuldade": ["Difficulty", "Dificultad", "难度"], "Adversário": ["Opponent", "Oponente", "对手"], "Origem dos dados": ["Data source", "Origen de los datos", "数据来源"], "Cache": ["Cache", "Caché", "缓存"], "Dados simulados": ["Simulated data", "Datos simulados", "模拟数据"], "Duração": ["Duration", "Duración", "时长"], "Pontuação": ["Score", "Puntuación", "得分"], "pontos": ["points", "puntos", "分"], "Jogador": ["Player", "Jugador", "玩家"], "Computador": ["Computer", "Computador", "计算机"], "Jogadas": ["Moves", "Jugadas", "行动次数"], "Acertos": ["Hits", "Aciertos", "命中"], "Erros": ["Misses", "Errores", "未命中"], "Navios afundados": ["Ships sunk", "Barcos hundidos", "击沉舰船"], "Seu tabuleiro": ["Your board", "Tu tablero", "你的棋盘"], "Tabuleiro do adversário": ["Opponent's board", "Tablero del oponente", "对手棋盘"],
    "BATALHA NAVAL QUÂNTICA": ["QUANTUM BATTLESHIP", "BATALLA NAVAL CUÁNTICA", "量子战舰"], "Selecione um hardware para calcular a tarifa.": ["Select hardware to calculate the tariff.", "Selecciona hardware para calcular la tarifa.", "选择硬件以计算费用。"],
    "Selecione um hardware quântico como oponente!": ["Select a quantum computer as your opponent!", "¡Selecciona un hardware cuántico como oponente!", "请选择一台量子计算机作为对手！"], "Digite uma coordenada válida!": ["Enter a valid coordinate!", "¡Escribe una coordenada válida!", "请输入有效坐标！"], "Sessão do jogo não encontrada. Inicie uma nova partida.": ["Game session not found. Start a new match.", "No se encontró la sesión. Inicia una nueva partida.", "未找到游戏会话。请开始新对局。"], "Digite seu nome para continuar.": ["Enter your name to continue.", "Escribe tu nombre para continuar.", "请输入姓名以继续。"], "Jogo encerrado. Obrigado pela visita!": ["Game ended. Thanks for playing!", "Partida finalizada. ¡Gracias por jugar!", "游戏已结束，感谢参与！"], "Idioma": ["Language", "Idioma", "语言"],
};

Object.assign(LANGUAGE_STRINGS, {
    "Análise de hardware · Batalha Naval Quântica": ["Hardware analysis · Quantum Battleship", "Análisis de hardware · Batalla Naval Cuántica", "硬件分析 · 量子战舰"],
    "Partida recuperada.": ["Match restored.", "Partida recuperada.", "对局已恢复。"],
    "Erro ao recuperar partida: {message}": ["Error restoring match: {message}", "Error al recuperar la partida: {message}", "恢复对局失败：{message}"],
    "Partida em andamento. Jogador: {name} · {backend}": ["Match in progress. Player: {name} · {backend}", "Partida en curso. Jugador: {name} · {backend}", "对局进行中。玩家：{name} · {backend}"],
    "Erro ao entrar na fila: {message}": ["Queue error: {message}", "Error al entrar en la cola: {message}", "加入队列失败：{message}"],
    "Selecione um computador quântico": ["Select a quantum computer", "Selecciona un computador cuántico", "请选择量子计算机"],
    "Computador clássico": ["Classical computer", "Computador clásico", "经典计算机"],
    "Análise das medições": ["Measurement analysis", "Análisis de las mediciones", "测量分析"],
    "Frequências por célula, em ordem de linha e coluna; linha horizontal indica frequência esperada": ["Cell frequencies by row and column; horizontal line shows the expected frequency", "Frecuencias por casilla, por fila y columna; la línea horizontal indica la frecuencia esperada", "按行列排列的格子频率；水平线表示期望频率"],
    "Duração indisponível": ["Duration unavailable", "Duración no disponible", "时长不可用"],
    "Você atacou {coordinate} → {message}": ["You attacked {coordinate} → {message}", "Atacaste {coordinate} → {message}", "你攻击了 {coordinate} → {message}"],
    "Erro ao iniciar: {message}": ["Error starting match: {message}", "Error al iniciar la partida: {message}", "开始对局失败：{message}"],
    "Erro no ataque: {message}": ["Attack error: {message}", "Error de ataque: {message}", "攻击错误：{message}"],
    "Erro no ataque quântico: {message}": ["Quantum attack error: {message}", "Error en el ataque cuántico: {message}", "量子攻击错误：{message}"],
    "Jogo em andamento. Jogador: {name} · {backend}": ["Match in progress. Player: {name} · {backend}", "Partida en curso. Jugador: {name} · {backend}", "对局进行中。玩家：{name} · {backend}"],
    "Iniciando partida… ({backend})": ["Starting match… ({backend})", "Iniciando partida… ({backend})", "正在开始对局…（{backend}）"],
    "Jogo retomado. Jogador: {player}": ["Game resumed. Player: {player}", "Partida reanudada. Jugador: {player}", "游戏已恢复。玩家：{player}"],
    "Frequências esperadas baixas: aproximação χ² inadequada.": ["Low expected frequencies: χ² approximation is unsuitable.", "Frecuencias esperadas bajas: la aproximación χ² no es adecuada.", "期望频数较低：χ² 近似不适用。"],
    "Não foi possível capturar a imagem. Tente novamente ou baixe os dados JSON.": ["Could not capture the image. Try again or download the JSON data.", "No se pudo capturar la imagen. Inténtalo de nuevo o descarga los datos JSON.", "无法截取图片。请重试或下载 JSON 数据。"],
    "Ataques observados": ["Observed attacks", "Ataques observados", "观测攻击"],
    "Fração de bits 1": ["Fraction of 1 bits", "Fracción de bits 1", "1 位比例"],
    "Peso de Hamming (número de bits 1)": ["Hamming weight (number of 1 bits)", "Peso de Hamming (número de bits 1)", "汉明重量（1 位数）"],
    "Contagem": ["Count", "Recuento", "计数"],
    "Linha observada": ["Observed row", "Fila observada", "观测行"],
    "Coluna observada": ["Observed column", "Columna observada", "观测列"],
    "Baseline ponderado": ["Weighted baseline", "Referencia ponderada", "加权基线"],
    "Frequência observada": ["Observed frequency", "Frecuencia observada", "观测频率"],
    "Entropia / máximo": ["Entropy / maximum", "Entropía / máximo", "熵 / 最大值"],
    "Entropia de Shannon": ["Shannon entropy", "Entropía de Shannon", "香农熵"],
    "χ² / graus de liberdade": ["χ² / degrees of freedom", "χ² / grados de libertad", "χ² / 自由度"],
    "Referência descritiva": ["Descriptive reference", "Referencia descriptiva", "描述性参考值"],
    "Esperado uniforme": ["Uniform expectation", "Esperado uniforme", "均匀期望值"],
    "Linha do tabuleiro": ["Board row", "Fila del tablero", "棋盘行"],
    "Carregando partidas": ["Loading matches", "Cargando partidas", "正在加载对局"],
    "Sem partidas para esta seleção": ["No matches for this selection", "No hay partidas para esta selección", "此选项没有对局"],
    "Análise atualizada": ["Analysis updated", "Análisis actualizado", "分析已更新"],
    "Nenhum hardware listado": ["No hardware listed", "No hay hardware", "没有列出硬件"],
    "Falha ao carregar a análise": ["Failed to load analysis", "No se pudo cargar el análisis", "加载分析失败"],
    "{count} ataques clássicos excluídos · {simulated} partidas simuladas de hardware incluídas": ["{count} classical attacks excluded · {simulated} simulated hardware matches included", "{count} ataques clásicos excluidos · {simulated} partidas simuladas de hardware incluidas", "已排除 {count} 次经典攻击 · 纳入 {simulated} 局硬件模拟对局"],
    "Selecione um computador": ["Select a computer", "Selecciona un computador", "请选择计算机"],
    "Atualizando partidas": ["Updating matches", "Actualizando partidas", "正在更新对局"],
    "Partida recuperada (backend: {backend})": ["Match restored (backend: {backend})", "Partida recuperada (backend: {backend})", "对局已恢复（后端：{backend}）"],
    "Backend \"{backend}\" OFFLINE (sem cache) para tabuleiro {size}.": ["Backend \"{backend}\" OFFLINE (no cache) for board {size}.", "Backend \"{backend}\" DESCONECTADO (sin caché) para el tablero {size}.", "后端 \"{backend}\" 离线（无缓存），棋盘大小为 {size}。"],
    "Backend \"{backend}\" está OFFLINE para tabuleiro {size}.": ["Backend \"{backend}\" is OFFLINE for board {size}.", "Backend \"{backend}\" está DESCONECTADO para el tablero {size}.", "后端 \"{backend}\" 离线，棋盘大小为 {size}。"],
});

Object.assign(LANGUAGE_STRINGS, {
    "{count} ataques quânticos": ["{count} quantum attacks", "{count} ataques cuánticos", "{count} 次量子攻击"],
    "{total} partidas · {simulated} testes simulados incluídos · {board}": ["{total} matches · {simulated} simulated tests included · {board}", "{total} partidas · {simulated} pruebas simuladas incluidas · {board}", "{total} 局对战 · 纳入 {simulated} 次模拟测试 · {board}"],
    "todos os tamanhos": ["all board sizes", "todos los tamaños", "所有棋盘尺寸"],
    "tabuleiro {size} × {size} · {qubits} qubits": ["{size} × {size} board · {qubits} qubits", "tablero {size} × {size} · {qubits} qubits", "{size} × {size} 棋盘 · {qubits} 个量子位"],
    "{observed} de {total} casas observadas · {repeated} repetidas · {classical} clássicas excluídas": ["{observed} of {total} cells observed · {repeated} repeated · {classical} classical excluded", "{observed} de {total} casillas observadas · {repeated} repetidas · {classical} clásicas excluidas", "观测到 {observed}/{total} 个格子 · 重复 {repeated} 次 · 排除 {classical} 次经典攻击"],
    "Entropia relativa ao baseline ponderado por tamanho · {classical} clássicas excluídas": ["Entropy relative to the size-weighted baseline · {classical} classical excluded", "Entropía relativa a la referencia ponderada por tamaño · {classical} clásicas excluidas", "相对于按棋盘尺寸加权基线的熵 · 排除 {classical} 次经典攻击"],
    "Sem dados quânticos arquivados para esta seleção.": ["No quantum data archived for this selection.", "No hay datos cuánticos archivados para esta selección.", "此选项没有已归档的量子数据。"],
    "Nenhuma partida arquivada para esta seleção.": ["No matches archived for this selection.", "No hay partidas archivadas para esta selección.", "此选项没有已归档的对局。"],
    "Hardware associado": ["Associated hardware", "Hardware asociado", "关联硬件"],
    "Modo de geração": ["Generation mode", "Modo de generación", "生成模式"],
    "Cache do hardware": ["Hardware cache", "Caché del hardware", "硬件缓存"],
    "Simulador direto": ["Direct simulator", "Simulador directo", "直接模拟器"],
    "Acertos quânticos": ["Quantum hits", "Aciertos cuánticos", "量子命中"],
    "Incluída nos índices": ["Included in metrics", "Incluida en las métricas", "已纳入指标"],
    "Sim": ["Yes", "Sí", "是"],
    "Não · sem ataques quânticos": ["No · no quantum attacks", "No · sin ataques cuánticos", "否 · 无量子攻击"],
    "jogador": ["player", "jugador", "玩家"],
    "computador": ["computer", "computador", "计算机"],
    "Data indisponível": ["Date unavailable", "Fecha no disponible", "日期不可用"],
});

Object.assign(LANGUAGE_STRINGS, {
    "{count} ataques quânticos": ["{count} quantum attacks", "{count} ataques cuánticos", "{count} 次量子攻击"],
    "{total} partidas · {simulated} testes simulados incluídos · todos os tamanhos": ["{total} matches · {simulated} simulated tests included · all board sizes", "{total} partidas · {simulated} pruebas simuladas incluidas · todos los tamaños", "{total} 局对战 · 纳入 {simulated} 次模拟测试 · 所有棋盘尺寸"],
    "{total} partidas · {simulated} testes simulados incluídos · tabuleiro {size} × {size} · {qubits} qubits": ["{total} matches · {simulated} simulated tests included · {size} × {size} board · {qubits} qubits", "{total} partidas · {simulated} pruebas simuladas incluidas · tablero {size} × {size} · {qubits} qubits", "{total} 局对战 · 纳入 {simulated} 次模拟测试 · {size} × {size} 棋盘 · {qubits} 个量子位"],
    "{count} ataques clássicos excluídos · {simulated} partidas simuladas de hardware incluídas": ["{count} classical attacks excluded · {simulated} simulated hardware matches included", "{count} ataques clásicos excluidos · {simulated} partidas simuladas de hardware incluidas", "排除 {count} 次经典攻击 · 纳入 {simulated} 局硬件模拟对局"],
    "{observed} de {total} casas observadas · {repeated} repetidas · {classical} clássicas excluídas": ["{observed} of {total} cells observed · {repeated} repeated · {classical} classical excluded", "{observed} de {total} casillas observadas · {repeated} repetidas · {classical} clásicas excluidas", "观测到 {observed}/{total} 个格子 · 重复 {repeated} 次 · 排除 {classical} 次经典攻击"],
    "Entropia relativa ao baseline ponderado por tamanho · {classical} clássicas excluídas": ["Entropy relative to the size-weighted baseline · {classical} classical excluded", "Entropía relativa a la referencia ponderada por tamaño · {classical} clásicas excluidas", "相对于按棋盘尺寸加权基线的熵 · 排除 {classical} 次经典攻击"],
    "Sem dados quânticos arquivados para esta seleção.": ["No quantum data archived for this selection.", "No hay datos cuánticos archivados para esta selección.", "此选项没有已归档的量子数据。"],
    "Nenhuma partida arquivada para esta seleção.": ["No matches archived for this selection.", "No hay partidas archivadas para esta selección.", "此选项没有已归档的对局。"],
    "Hardware associado": ["Associated hardware", "Hardware asociado", "关联硬件"],
    "Modo de geração": ["Generation mode", "Modo de generación", "生成模式"],
    "Cache do hardware": ["Hardware cache", "Caché del hardware", "硬件缓存"],
    "Simulador direto": ["Direct simulator", "Simulador directo", "直接模拟器"],
    "Acertos quânticos": ["Quantum hits", "Aciertos cuánticos", "量子命中"],
    "Incluída nos índices": ["Included in metrics", "Incluida en las métricas", "已纳入指标"],
    "Sim": ["Yes", "Sí", "是"],
    "Não · sem ataques quânticos": ["No · no quantum attacks", "No · sin ataques cuánticos", "否 · 无量子攻击"],
    "jogador": ["player", "jugador", "玩家"],
    "computador": ["computer", "computador", "计算机"],
    "Data indisponível": ["Date unavailable", "Fecha no disponible", "日期不可用"],
});

Object.assign(LANGUAGE_STRINGS, {
    "e, ao final, você receberá uma análise referente aos números produzidos nesta partida.": ["and you will receive an analysis of the numbers produced in this match.", "y recibirás un análisis de los números producidos en esta partida.", "结束后你将收到关于本局产生数字的分析。"],
    "Quântico": ["Quantum", "Cuántico", "量子"],
    "Plus · quântico + clássico": ["Plus · quantum + classical", "Plus · cuántico + clásico", "Plus · 量子 + 经典"],
    "{count} pontos": ["{count} points", "{count} puntos", "{count} 分"],
    "Partida {id}": ["Match {id}", "Partida {id}", "对局 {id}"],
    "{sunk} de {total} afundados": ["{sunk} of {total} sunk", "{sunk} de {total} hundidos", "已击沉 {sunk}/{total}"],
    "{name} · {count} teste": ["{name} · {count} test", "{name} · {count} prueba", "{name} · {count} 次测试"],
    "{name} · {count} testes": ["{name} · {count} tests", "{name} · {count} pruebas", "{name} · {count} 次测试"],
    "Partidas que compõem a amostra": ["Matches included in the sample", "Partidas incluidas en la muestra", "样本包含的对局"],
    "{base}. {note} Frequências esperadas baixas: aproximação χ² inadequada.": ["{base}. {note} Low expected frequencies: χ² approximation is unsuitable.", "{base}. {note} Frecuencias esperadas bajas: la aproximación χ² no es adecuada.", "{base}。{note} 期望频数较低：χ² 近似不适用。"],
});

Object.assign(LANGUAGE_STRINGS, {
    "Dados simulados (Sem custo)": ["Simulated data (No cost)", null, "模拟数据（免费）"],
    "Divirta-se!": ["Enjoy the game!", null, "祝你玩得开心！"],
    "Links do projeto": ["Project links", null, "项目链接"],
    "Código-fonte no GitHub": ["Source code on GitHub", null, "GitHub 源代码"],
    "Página pessoal": ["Personal website", null, "个人网站"],
    "US$ 0 · sem execução de QPU": ["US$ 0 · no QPU execution", null, "US$ 0 · 不运行 QPU"],
});

let currentLanguage = "pt";
const textSources = new WeakMap();
const textOutputs = new WeakMap();
const textValues = new WeakMap();
const attributeSources = new WeakMap();
const attributeOutputs = new WeakMap();
const attributeValues = new WeakMap();
const reverseTranslations = new Map();
const originalTitle = document.title;

function translate(source, values = {}) {
    const entry = LANGUAGE_STRINGS[source];
    const template = currentLanguage === "pt" || !entry ? source : entry[LANGUAGE_TRANSLATION_INDEX[currentLanguage]];
    return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
}

function t(source, values = {}) {
    const rendered = translate(source, values);
    if (rendered !== source) reverseTranslations.set(rendered, { source, values });
    return rendered;
}

window.t = t;
window.getSiteLanguage = () => currentLanguage;
window.getSiteLocale = () => LANGUAGE_LOCALES[currentLanguage] || "pt-BR";

function localizeTextNode(node) {
    const raw = node.nodeValue || "";
    const previousOutput = textOutputs.get(node);
    const leading = raw.match(/^\s*/)?.[0] || "";
    const trailing = raw.match(/\s*$/)?.[0] || "";
    const content = raw.slice(leading.length, raw.length - trailing.length);
    if (!content) return;
    const priorTranslation = reverseTranslations.get(content);
    const storedSource = textSources.get(node);
    const unchanged = storedSource && raw === previousOutput;
    const normalizedContent = content.replace(/\s+/g, " ");
    const source = unchanged ? storedSource : priorTranslation?.source || (LANGUAGE_STRINGS[normalizedContent] ? normalizedContent : content);
    const values = unchanged ? textValues.get(node) || {} : priorTranslation?.values || {};
    textSources.set(node, source);
    textValues.set(node, values);
    const translated = `${leading}${translate(source, values)}${trailing}`;
    if (translated !== raw) node.nodeValue = translated;
    textOutputs.set(node, translated);
}

function localizeAttribute(element, attribute) {
    const raw = element.getAttribute(attribute);
    if (raw == null) return;
    let sources = attributeSources.get(element);
    let outputs = attributeOutputs.get(element);
    if (!sources) {
        sources = new Map();
        outputs = new Map();
        attributeSources.set(element, sources);
        attributeOutputs.set(element, outputs);
    }
    const unchanged = sources.has(attribute) && raw === outputs.get(attribute);
    const priorTranslation = reverseTranslations.get(raw);
    const source = unchanged ? sources.get(attribute) : priorTranslation?.source || raw;
    const values = unchanged ? attributeValues.get(element)?.get(attribute) || {} : priorTranslation?.values || {};
    sources.set(attribute, source);
    let storedValues = attributeValues.get(element);
    if (!storedValues) {
        storedValues = new Map();
        attributeValues.set(element, storedValues);
    }
    storedValues.set(attribute, values);
    const translated = translate(source, values);
    if (translated !== raw) element.setAttribute(attribute, translated);
    outputs.set(attribute, translated);
}

function localizeElement(element) {
    for (const attribute of ["title", "aria-label", "placeholder", "alt"]) localizeAttribute(element, attribute);
    for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) localizeTextNode(child);
        else if (child.nodeType === Node.ELEMENT_NODE && !["SCRIPT", "STYLE"].includes(child.tagName)) localizeElement(child);
    }
}

function updateLanguageButtons() {
    document.querySelectorAll("[data-language]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.language === currentLanguage));
    });
}

function setSiteLanguage(language, persist = true) {
    if (!LANGUAGES.includes(language)) return;
    currentLanguage = language;
    document.documentElement.lang = LANGUAGE_LOCALES[language];
    if (persist) {
        try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { }
    }
    for (const [source, values] of Object.entries(LANGUAGE_STRINGS)) {
        const translated = values[LANGUAGE_TRANSLATION_INDEX[language]];
        if (translated) reverseTranslations.set(translated, { source, values: {} });
    }
    if (document.body) localizeElement(document.body);
    document.title = translate(originalTitle);
    updateLanguageButtons();
    document.dispatchEvent(new CustomEvent("site-language-change", { detail: { language } }));
}

function initializeLanguage() {
    let saved = "pt";
    try { saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) || "pt"; } catch { }
    if (!LANGUAGES.includes(saved)) saved = "pt";
    document.querySelectorAll("[data-language]").forEach(button => {
        button.addEventListener("click", () => setSiteLanguage(button.dataset.language));
    });
    setSiteLanguage(saved, false);
    const observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === "characterData") localizeTextNode(record.target);
            for (const node of record.addedNodes || []) {
                if (node.nodeType === Node.TEXT_NODE) localizeTextNode(node);
                else if (node.nodeType === Node.ELEMENT_NODE) localizeElement(node);
            }
            if (record.type === "attributes") localizeAttribute(record.target, record.attributeName);
        }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label", "placeholder", "alt"] });
}

initializeLanguage();
