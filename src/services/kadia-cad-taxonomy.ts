import type { ProductClassification } from "../types.js";

type TaxonomyEntry = {
  secaoId: string;
  secaoNome: string;
  grupoId: string;
  grupoNome: string;
  subgrupoId: string;
  subgrupoNome: string;
  keywords?: string[];
};

const STOPWORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "para",
  "por",
  "sem",
  "tipo",
  "kit",
  "item"
]);

const TAXONOMY: TaxonomyEntry[] = [
  { secaoId: "2", secaoNome: "PET SHOP", grupoId: "1", grupoNome: "BRINQUEDOS", subgrupoId: "1", subgrupoNome: "MORDEDORES", keywords: ["mordedor", "pet", "cachorro", "cao"] },
  { secaoId: "2", secaoNome: "PET SHOP", grupoId: "1", grupoNome: "BRINQUEDOS", subgrupoId: "2", subgrupoNome: "ARRANHADORES", keywords: ["arranhador", "gato", "felino"] },
  { secaoId: "2", secaoNome: "PET SHOP", grupoId: "2", grupoNome: "ALIMENTAÇÃO", subgrupoId: "1", subgrupoNome: "BEBEDOURO", keywords: ["bebedouro", "fonte pet"] },
  { secaoId: "2", secaoNome: "PET SHOP", grupoId: "2", grupoNome: "ALIMENTAÇÃO", subgrupoId: "3", subgrupoNome: "COMEDOUROS DE AÇO", keywords: ["comedouro aco", "comedouro inox"] },
  { secaoId: "2", secaoNome: "PET SHOP", grupoId: "2", grupoNome: "ALIMENTAÇÃO", subgrupoId: "4", subgrupoNome: "COMEDOUROS DE PLÁSTICO", keywords: ["comedouro plastico"] },
  { secaoId: "2", secaoNome: "PET SHOP", grupoId: "3", grupoNome: "HIGIENE E CUIDADOS", subgrupoId: "1", subgrupoNome: "APARADOR DE PELOS", keywords: ["aparador pelos", "tosador"] },
  { secaoId: "2", secaoNome: "PET SHOP", grupoId: "3", grupoNome: "HIGIENE E CUIDADOS", subgrupoId: "5", subgrupoNome: "ANTIPULGAS", keywords: ["antipulga", "pulga", "carrapato"] },
  { secaoId: "2", secaoNome: "PET SHOP", grupoId: "4", grupoNome: "PASSEIO E CONTROLE", subgrupoId: "6", subgrupoNome: "COLEIRA DE PESCOÇO", keywords: ["coleira pescoco"] },
  { secaoId: "2", secaoNome: "PET SHOP", grupoId: "4", grupoNome: "PASSEIO E CONTROLE", subgrupoId: "7", subgrupoNome: "COLEIRA PEITORAL", keywords: ["peitoral pet", "coleira peitoral"] },
  { secaoId: "2", secaoNome: "PET SHOP", grupoId: "4", grupoNome: "PASSEIO E CONTROLE", subgrupoId: "8", subgrupoNome: "GUIA", keywords: ["guia pet", "guia cachorro"] },

  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "1", grupoNome: "BANHEIRO", subgrupoId: "1", subgrupoNome: "PORTA SABÃO", keywords: ["porta sabao", "saboneteira"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "1", grupoNome: "BANHEIRO", subgrupoId: "2", subgrupoNome: "ESCOVA SANITÁRIA", keywords: ["escova sanitaria"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "1", grupoNome: "BANHEIRO", subgrupoId: "3", subgrupoNome: "TAMPA DE VASO SANITÁRIO", keywords: ["tampa vaso", "assento sanitario"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "1", grupoNome: "BANHEIRO", subgrupoId: "4", subgrupoNome: "ACESSÓRIOS PARA VASO SANITÁRIO", keywords: ["acessorio vaso sanitario"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "1", grupoNome: "BANHEIRO", subgrupoId: "5", subgrupoNome: "ORGANIZADORES DE BANHEIRO", keywords: ["organizador banheiro"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "1", grupoNome: "BANHEIRO", subgrupoId: "6", subgrupoNome: "SUPORTE PARA PAPEL HIGIÊNICO", keywords: ["suporte papel higienico", "porta papel higienico"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "1", grupoNome: "BANHEIRO", subgrupoId: "7", subgrupoNome: "CORTINAS PARA BOX", keywords: ["cortina box"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "1", grupoNome: "BANHEIRO", subgrupoId: "8", subgrupoNome: "VARÕES E SUPORTES PARA CORTINA", keywords: ["varao cortina", "suporte cortina"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "1", subgrupoNome: "TALHERES", keywords: ["talher", "garfo", "faca", "colher"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "2", subgrupoNome: "TALHERES DE SILICONE", keywords: ["talher silicone", "espatula silicone", "colher silicone"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "3", subgrupoNome: "FAQUEIROS", keywords: ["faqueiro"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "4", subgrupoNome: "VASILHAS", keywords: ["vasilha", "tigela"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "5", subgrupoNome: "POTES", keywords: ["pote", "recipiente"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "6", subgrupoNome: "ESCORREDORES DE LOUÇA", keywords: ["escorredor louca"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "7", subgrupoNome: "PORTA TEMPEROS", keywords: ["porta tempero"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "8", subgrupoNome: "TÁBUAS DE CORTE", keywords: ["tabua corte"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "9", subgrupoNome: "ABRIDORES", keywords: ["abridor"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "10", subgrupoNome: "FORMAS", keywords: ["forma bolo", "assadeira", "forma"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "11", subgrupoNome: "BALANCAS DIGITAIS", keywords: ["balanca digital", "balanca cozinha"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "12", subgrupoNome: "FRUTEIRAS", keywords: ["fruteira"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "13", subgrupoNome: "SELADORAS", keywords: ["seladora"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "14", subgrupoNome: "MIXERS", keywords: ["mixer"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "15", subgrupoNome: "JOGO DE COPOS", keywords: ["jogo copo", "copo vidro"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "16", subgrupoNome: "JARRAS", keywords: ["jarra"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "17", subgrupoNome: "XICARAS COM PIRES", keywords: ["xicara", "pires"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "18", subgrupoNome: "CHALEIRA", keywords: ["chaleira"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "19", subgrupoNome: "ESPREMEDORES", keywords: ["espremedor"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "2", grupoNome: "COZINHA", subgrupoId: "20", subgrupoNome: "TRAVESSA", keywords: ["travessa"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "3", grupoNome: "DECORAÇÃO", subgrupoId: "1", subgrupoNome: "VASOS DECORATIVOS", keywords: ["vaso decorativo"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "3", grupoNome: "DECORAÇÃO", subgrupoId: "2", subgrupoNome: "PLANTAS ARTIFICIAIS", keywords: ["planta artificial"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "3", grupoNome: "DECORAÇÃO", subgrupoId: "3", subgrupoNome: "ESCULTURAS", keywords: ["escultura", "estatua"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "3", grupoNome: "DECORAÇÃO", subgrupoId: "4", subgrupoNome: "CACHEPÔS", keywords: ["cachepo"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "3", grupoNome: "DECORAÇÃO", subgrupoId: "5", subgrupoNome: "TAPETES", keywords: ["tapete"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "3", grupoNome: "DECORAÇÃO", subgrupoId: "6", subgrupoNome: "MOLDURAS", keywords: ["moldura", "porta retrato"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "3", grupoNome: "DECORAÇÃO", subgrupoId: "7", subgrupoNome: "ESPELHO", keywords: ["espelho"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "3", grupoNome: "DECORAÇÃO", subgrupoId: "8", subgrupoNome: "DIFUSORES E AROMATIZADORES", keywords: ["difusor", "aromatizador"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "4", grupoNome: "ILUMINAÇÃO E ELÉTRICA", subgrupoId: "1", subgrupoNome: "LÂMPADAS", keywords: ["lampada", "bulbo"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "4", grupoNome: "ILUMINAÇÃO E ELÉTRICA", subgrupoId: "2", subgrupoNome: "EXTENSÕES E FILTROS DE LINHA", keywords: ["extensao", "filtro linha"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "4", grupoNome: "ILUMINAÇÃO E ELÉTRICA", subgrupoId: "3", subgrupoNome: "SOQUETES", keywords: ["soquete"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "4", grupoNome: "ILUMINAÇÃO E ELÉTRICA", subgrupoId: "4", subgrupoNome: "INTERRUPTORES SIMPLES", keywords: ["interruptor"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "4", grupoNome: "ILUMINAÇÃO E ELÉTRICA", subgrupoId: "5", subgrupoNome: "LUMINARIAS E ABAJUR", keywords: ["luminaria", "abajur"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "4", grupoNome: "ILUMINAÇÃO E ELÉTRICA", subgrupoId: "6", subgrupoNome: "FERRO E LIMPADOR DE PASSAR", keywords: ["ferro passar", "passadeira"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "5", grupoNome: "DECORAÇÃO DE NATAL", subgrupoId: "1", subgrupoNome: "LUZES LED", keywords: ["luz natal", "pisca pisca", "luz led natal"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "5", grupoNome: "DECORAÇÃO DE NATAL", subgrupoId: "2", subgrupoNome: "ÁRVORES DE NATAL", keywords: ["arvore natal"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "5", grupoNome: "DECORAÇÃO DE NATAL", subgrupoId: "3", subgrupoNome: "PRESÉPIOS", keywords: ["presepio"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "5", grupoNome: "DECORAÇÃO DE NATAL", subgrupoId: "4", subgrupoNome: "ENFEITES PARA ÁRVORE", keywords: ["enfeite arvore natal", "bola natal"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "6", grupoNome: "JARDINAGEM", subgrupoId: "1", subgrupoNome: "VASOS PARA PLANTAS", keywords: ["vaso planta"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "6", grupoNome: "JARDINAGEM", subgrupoId: "2", subgrupoNome: "SUPORTES PARA VASOS", keywords: ["suporte vaso"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "6", grupoNome: "JARDINAGEM", subgrupoId: "3", subgrupoNome: "PAINÉIS PARA VASOS", keywords: ["painel vaso"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "6", grupoNome: "JARDINAGEM", subgrupoId: "4", subgrupoNome: "REGADORES", keywords: ["regador"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "6", grupoNome: "JARDINAGEM", subgrupoId: "5", subgrupoNome: "ACESSÓRIOS PARA JARDINAGEM", keywords: ["jardinagem"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "7", grupoNome: "ORGANIZAÇÃO", subgrupoId: "1", subgrupoNome: "CAIXAS ORGANIZADORAS", keywords: ["caixa organizadora"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "7", grupoNome: "ORGANIZAÇÃO", subgrupoId: "2", subgrupoNome: "ORGANIZADORES MULTIUSO", keywords: ["organizador multiuso"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "7", grupoNome: "ORGANIZAÇÃO", subgrupoId: "3", subgrupoNome: "CESTOS ORGANIZADORES", keywords: ["cesto organizador"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "7", grupoNome: "ORGANIZAÇÃO", subgrupoId: "4", subgrupoNome: "SUPORTES DIVERSO", keywords: ["suporte", "suporte diverso"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "8", grupoNome: "LAVANDERIA E LIMPEZA", subgrupoId: "1", subgrupoNome: "ESCOVAS E ASPIRADORES", keywords: ["escova", "aspirador"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "8", grupoNome: "LAVANDERIA E LIMPEZA", subgrupoId: "2", subgrupoNome: "PANOS DE LIMPEZA", keywords: ["pano limpeza", "flanela"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "8", grupoNome: "LAVANDERIA E LIMPEZA", subgrupoId: "3", subgrupoNome: "RODOS", keywords: ["rodo"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "8", grupoNome: "LAVANDERIA E LIMPEZA", subgrupoId: "4", subgrupoNome: "VASSOURAS", keywords: ["vassoura"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "8", grupoNome: "LAVANDERIA E LIMPEZA", subgrupoId: "5", subgrupoNome: "BALDES", keywords: ["balde"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "8", grupoNome: "LAVANDERIA E LIMPEZA", subgrupoId: "6", subgrupoNome: "PREGADORES DE ROUPA", keywords: ["pregador roupa"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "8", grupoNome: "LAVANDERIA E LIMPEZA", subgrupoId: "7", subgrupoNome: "CESTOS DE ROUPA", keywords: ["cesto roupa"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "8", grupoNome: "LAVANDERIA E LIMPEZA", subgrupoId: "8", subgrupoNome: "ORGANIZADORES DE LAVANDERIA", keywords: ["organizador lavanderia"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "8", grupoNome: "LAVANDERIA E LIMPEZA", subgrupoId: "9", subgrupoNome: "DETERGENTES E LÍQUIDOS", keywords: ["detergente", "liquido limpeza"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "8", grupoNome: "LAVANDERIA E LIMPEZA", subgrupoId: "10", subgrupoNome: "LIXEIRAS", keywords: ["lixeira"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "8", grupoNome: "LAVANDERIA E LIMPEZA", subgrupoId: "11", subgrupoNome: "VARAL", keywords: ["varal"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "9", grupoNome: "CAMA, MESA E BANHO", subgrupoId: "1", subgrupoNome: "LENÇÓIS E COBERTORES", keywords: ["lencol", "cobertor"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "9", grupoNome: "CAMA, MESA E BANHO", subgrupoId: "2", subgrupoNome: "TOALHAS", keywords: ["toalha"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "9", grupoNome: "CAMA, MESA E BANHO", subgrupoId: "3", subgrupoNome: "CAPAS DE ALMOFADA", keywords: ["capa almofada"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "9", grupoNome: "CAMA, MESA E BANHO", subgrupoId: "4", subgrupoNome: "ALMOFADAS", keywords: ["almofada"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "9", grupoNome: "CAMA, MESA E BANHO", subgrupoId: "5", subgrupoNome: "TOUCA", keywords: ["touca"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "10", grupoNome: "FERRAMENTAS", subgrupoId: "1", subgrupoNome: "FERRAMENTAS MANUAIS", keywords: ["ferramenta", "alicate", "chave", "martelo", "inglesa", "trena"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "10", grupoNome: "FERRAMENTAS", subgrupoId: "2", subgrupoNome: "FERRAMENTAS ELÉTRICAS", keywords: ["furadeira", "parafusadeira", "serra", "lixadeira"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "10", grupoNome: "FERRAMENTAS", subgrupoId: "3", subgrupoNome: "PARAFUSOS E FIXAÇÃO", keywords: ["parafuso", "bucha", "porca", "fixacao"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "10", grupoNome: "FERRAMENTAS", subgrupoId: "4", subgrupoNome: "PINTURA E ACABAMENTO", keywords: ["pintura", "pincel parede", "rolo pintura"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "10", grupoNome: "FERRAMENTAS", subgrupoId: "5", subgrupoNome: "ORGANIZAÇÃO DE FERRAMENTAS", keywords: ["caixa ferramenta", "organizador ferramenta"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "10", grupoNome: "FERRAMENTAS", subgrupoId: "6", subgrupoNome: "SEGURANÇA E PROTEÇÃO", keywords: ["luva protecao", "oculos protecao", "epi"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "10", grupoNome: "FERRAMENTAS", subgrupoId: "7", subgrupoNome: "PILHAS E BATERIAS", keywords: ["pilha", "bateria"] },
  { secaoId: "3", secaoNome: "UTILIDADES DOMÉSTICAS", grupoId: "11", grupoNome: "OBJETO PORTÁTIL", subgrupoId: "1", subgrupoNome: "GUARDA CHUVA E CAPA DE CHUVA", keywords: ["guarda chuva", "capa chuva"] },

  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "1", grupoNome: "LIVROS E CADERNOS", subgrupoId: "1", subgrupoNome: "LIVROS DE COLORIR", keywords: ["livro colorir"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "1", grupoNome: "LIVROS E CADERNOS", subgrupoId: "2", subgrupoNome: "LIVROS DIDÁTICOS", keywords: ["livro didatico"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "1", grupoNome: "LIVROS E CADERNOS", subgrupoId: "3", subgrupoNome: "BOBBIE GOODS", keywords: ["bobbie goods"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "1", grupoNome: "LIVROS E CADERNOS", subgrupoId: "4", subgrupoNome: "AGENDAS", keywords: ["agenda"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "1", grupoNome: "LIVROS E CADERNOS", subgrupoId: "5", subgrupoNome: "CADERNOS", keywords: ["caderno"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "2", grupoNome: "MATERIAL DE ESCRITÓRIO", subgrupoId: "1", subgrupoNome: "RÉGUAS", keywords: ["regua"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "2", grupoNome: "MATERIAL DE ESCRITÓRIO", subgrupoId: "2", subgrupoNome: "BORRACHAS", keywords: ["borracha"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "2", grupoNome: "MATERIAL DE ESCRITÓRIO", subgrupoId: "3", subgrupoNome: "APONTADORES", keywords: ["apontador"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "2", grupoNome: "MATERIAL DE ESCRITÓRIO", subgrupoId: "4", subgrupoNome: "MARCA TEXTO", keywords: ["marca texto"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "2", grupoNome: "MATERIAL DE ESCRITÓRIO", subgrupoId: "5", subgrupoNome: "COLA", keywords: ["cola"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "3", grupoNome: "ARTES E PINTURA", subgrupoId: "1", subgrupoNome: "TINTAS", keywords: ["tinta"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "3", grupoNome: "ARTES E PINTURA", subgrupoId: "2", subgrupoNome: "PINCÉIS", keywords: ["pincel"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "3", grupoNome: "ARTES E PINTURA", subgrupoId: "3", subgrupoNome: "CANETAS", keywords: ["caneta"] },
  { secaoId: "4", secaoNome: "PAPELARIA", grupoId: "3", grupoNome: "ARTES E PINTURA", subgrupoId: "4", subgrupoNome: "LAPIS DE COR", keywords: ["lapis cor"] },

  { secaoId: "5", secaoNome: "ÁREA KIDS", grupoId: "1", grupoNome: "PRIMEIRA INFÂNCIA", subgrupoId: "1", subgrupoNome: "SUPORTE PARA CHUPETA", keywords: ["suporte chupeta", "prendedor chupeta"] },
  { secaoId: "5", secaoNome: "ÁREA KIDS", grupoId: "1", grupoNome: "PRIMEIRA INFÂNCIA", subgrupoId: "2", subgrupoNome: "MAMADEIRAS", keywords: ["mamadeira"] },
  { secaoId: "5", secaoNome: "ÁREA KIDS", grupoId: "1", grupoNome: "PRIMEIRA INFÂNCIA", subgrupoId: "3", subgrupoNome: "BRINQUEDOS INFANTIS", keywords: ["brinquedo infantil", "primeira infancia"] },
  { secaoId: "5", secaoNome: "ÁREA KIDS", grupoId: "2", grupoNome: "BRINQUEDOS", subgrupoId: "1", subgrupoNome: "FAZ DE CONTA", keywords: ["faz de conta"] },
  { secaoId: "5", secaoNome: "ÁREA KIDS", grupoId: "2", grupoNome: "BRINQUEDOS", subgrupoId: "2", subgrupoNome: "DE MONTAR", keywords: ["montar", "blocos"] },
  { secaoId: "5", secaoNome: "ÁREA KIDS", grupoId: "2", grupoNome: "BRINQUEDOS", subgrupoId: "3", subgrupoNome: "PELÚCIAS", keywords: ["pelucia"] },
  { secaoId: "5", secaoNome: "ÁREA KIDS", grupoId: "2", grupoNome: "BRINQUEDOS", subgrupoId: "4", subgrupoNome: "BONECOS", keywords: ["boneco", "boneca"] },
  { secaoId: "5", secaoNome: "ÁREA KIDS", grupoId: "2", grupoNome: "BRINQUEDOS", subgrupoId: "5", subgrupoNome: "CARRINHOS", keywords: ["carrinho"] },
  { secaoId: "5", secaoNome: "ÁREA KIDS", grupoId: "2", grupoNome: "BRINQUEDOS", subgrupoId: "6", subgrupoNome: "BRINQUEDOS INTERATIVOS", keywords: ["brinquedo interativo"] },

  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "1", grupoNome: "COMPUTADORES E ACESSÓRIOS", subgrupoId: "1", subgrupoNome: "COOLERS E SUPORTE", keywords: ["cooler", "suporte notebook"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "1", grupoNome: "COMPUTADORES E ACESSÓRIOS", subgrupoId: "2", subgrupoNome: "MONITORES", keywords: ["monitor"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "1", grupoNome: "COMPUTADORES E ACESSÓRIOS", subgrupoId: "3", subgrupoNome: "TECLADOS E MOUSE", keywords: ["teclado", "mouse"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "1", grupoNome: "COMPUTADORES E ACESSÓRIOS", subgrupoId: "4", subgrupoNome: "MESA E CADEIRA GAMER", keywords: ["cadeira gamer", "mesa gamer"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "1", grupoNome: "COMPUTADORES E ACESSÓRIOS", subgrupoId: "5", subgrupoNome: "MOUSEPAD", keywords: ["mousepad"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "2", grupoNome: "CELULARES E TABLETS", subgrupoId: "1", subgrupoNome: "CAPAS E ACESSÓRIOS", keywords: ["capa celular", "pelicula", "acessorio celular"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "2", grupoNome: "CELULARES E TABLETS", subgrupoId: "2", subgrupoNome: "CARREGADORES E CABOS", keywords: ["carregador", "cabo usb", "fonte carregador"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "3", grupoNome: "ÁUDIO E VÍDEO", subgrupoId: "1", subgrupoNome: "FONES DE OUVIDO", keywords: ["fone ouvido", "headset"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "3", grupoNome: "ÁUDIO E VÍDEO", subgrupoId: "2", subgrupoNome: "CAIXAS DE SOM", keywords: ["caixa som", "speaker"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "3", grupoNome: "ÁUDIO E VÍDEO", subgrupoId: "3", subgrupoNome: "PROJETORES", keywords: ["projetor"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "3", grupoNome: "ÁUDIO E VÍDEO", subgrupoId: "4", subgrupoNome: "CFTV", keywords: ["cftv", "camera seguranca"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "4", grupoNome: "ARMAZENAMENTO E REDES", subgrupoId: "1", subgrupoNome: "PENDRIVES E CARTÕES DE MEMORIA", keywords: ["pendrive", "cartao memoria", "micro sd"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "4", grupoNome: "ARMAZENAMENTO E REDES", subgrupoId: "2", subgrupoNome: "SSDS E HDS", keywords: ["ssd", "hd externo", "hdd"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "4", grupoNome: "ARMAZENAMENTO E REDES", subgrupoId: "3", subgrupoNome: "ROTEADORES E MODEMS", keywords: ["roteador", "modem"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "4", grupoNome: "ARMAZENAMENTO E REDES", subgrupoId: "4", subgrupoNome: "CABOS UTP", keywords: ["cabo utp", "cabo rede", "rj45"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "5", grupoNome: "DISPOSITIVOS", subgrupoId: "1", subgrupoNome: "DRONES", keywords: ["drone"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "5", grupoNome: "DISPOSITIVOS", subgrupoId: "2", subgrupoNome: "RELÓGIOS", keywords: ["relogio", "smartwatch"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "5", grupoNome: "DISPOSITIVOS", subgrupoId: "3", subgrupoNome: "LANTERNAS", keywords: ["lanterna"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "5", grupoNome: "DISPOSITIVOS", subgrupoId: "4", subgrupoNome: "BALANCA DIGITAL", keywords: ["balanca digital", "balanca corporal"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "5", grupoNome: "DISPOSITIVOS", subgrupoId: "5", subgrupoNome: "MASSAGEADORES", keywords: ["massageador"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "5", grupoNome: "DISPOSITIVOS", subgrupoId: "6", subgrupoNome: "GAMES", keywords: ["game", "controle videogame", "console"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "5", grupoNome: "DISPOSITIVOS", subgrupoId: "7", subgrupoNome: "FRAGMENTADORA", keywords: ["fragmentadora"] },
  { secaoId: "6", secaoNome: "ELETRÔNICOS E INFORMÁTICA", grupoId: "5", grupoNome: "DISPOSITIVOS", subgrupoId: "8", subgrupoNome: "CAMPAINHIA", keywords: ["campainha"] },

  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "1", grupoNome: "BIJUTERIAS", subgrupoId: "1", subgrupoNome: "BRINCOS", keywords: ["brinco"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "1", grupoNome: "BIJUTERIAS", subgrupoId: "2", subgrupoNome: "COLARES", keywords: ["colar"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "1", grupoNome: "BIJUTERIAS", subgrupoId: "3", subgrupoNome: "PULSEIRAS", keywords: ["pulseira"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "1", grupoNome: "BIJUTERIAS", subgrupoId: "4", subgrupoNome: "BRACELETES", keywords: ["bracelete"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "1", grupoNome: "BIJUTERIAS", subgrupoId: "5", subgrupoNome: "PRENDEDORES DE CABELO", keywords: ["prendedor cabelo", "presilha cabelo"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "2", grupoNome: "BOLSAS E CARTEIRAS", subgrupoId: "1", subgrupoNome: "BOLSAS DE OMBRO", keywords: ["bolsa ombro"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "2", grupoNome: "BOLSAS E CARTEIRAS", subgrupoId: "2", subgrupoNome: "CARTEIRAS", keywords: ["carteira"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "2", grupoNome: "BOLSAS E CARTEIRAS", subgrupoId: "3", subgrupoNome: "ESTOJOS", keywords: ["estojo"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "2", grupoNome: "BOLSAS E CARTEIRAS", subgrupoId: "4", subgrupoNome: "MOCHILAS", keywords: ["mochila"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "3", grupoNome: "MAQUIAGEM E ORGANIZADORES", subgrupoId: "1", subgrupoNome: "ORGANIZADORES", keywords: ["organizador maquiagem"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "3", grupoNome: "MAQUIAGEM E ORGANIZADORES", subgrupoId: "2", subgrupoNome: "MAQUIAGEM", keywords: ["maquiagem", "batom", "paleta"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "3", grupoNome: "MAQUIAGEM E ORGANIZADORES", subgrupoId: "3", subgrupoNome: "PRENDEDORES,PRESILHAS,ELASTICO", keywords: ["presilha", "elastico cabelo", "prendedor cabelo"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "4", grupoNome: "HIGIENE PESSOAL", subgrupoId: "1", subgrupoNome: "ESCOVAS DE CABELO", keywords: ["escova cabelo"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "4", grupoNome: "HIGIENE PESSOAL", subgrupoId: "2", subgrupoNome: "ACESSÓRIOS PARA BANHO", keywords: ["acessorio banho", "bucha banho"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "4", grupoNome: "HIGIENE PESSOAL", subgrupoId: "3", subgrupoNome: "KITS DE CUIDADOS PESSOAIS", keywords: ["kit cuidado pessoal"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "4", grupoNome: "HIGIENE PESSOAL", subgrupoId: "4", subgrupoNome: "MAQUINA DE CORTAR CABELO", keywords: ["maquina cortar cabelo"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "5", grupoNome: "GARRAFAS", subgrupoId: "1", subgrupoNome: "GARRAFA TÉRMICA", keywords: ["garrafa termica"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "5", grupoNome: "GARRAFAS", subgrupoId: "2", subgrupoNome: "GARRAFA ISOTÉRMICA", keywords: ["garrafa isotermica"] },
  { secaoId: "7", secaoNome: "USO PESSOAL", grupoId: "5", grupoNome: "GARRAFAS", subgrupoId: "3", subgrupoNome: "GARRAFA DE PLÁSTICO", keywords: ["garrafa plastico", "squeeze"] },

  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "1", grupoNome: "SUPORTES E ACESSÓRIOS", subgrupoId: "1", subgrupoNome: "SUPORTE PARA CELULAR", keywords: ["suporte celular carro"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "1", grupoNome: "SUPORTES E ACESSÓRIOS", subgrupoId: "2", subgrupoNome: "SUPORTE VEICULAR MAGNÉTICO", keywords: ["suporte magnetico carro"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "1", grupoNome: "SUPORTES E ACESSÓRIOS", subgrupoId: "3", subgrupoNome: "SUPORTE PARA PAINEL E VIDRO", keywords: ["suporte painel", "suporte vidro carro"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "1", grupoNome: "SUPORTES E ACESSÓRIOS", subgrupoId: "4", subgrupoNome: "MONITOR VEICULAR", keywords: ["monitor veicular"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "2", grupoNome: "ELÉTRICA E ENERGIA", subgrupoId: "1", subgrupoNome: "CARREGADORES VEICULARES", keywords: ["carregador veicular"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "2", grupoNome: "ELÉTRICA E ENERGIA", subgrupoId: "2", subgrupoNome: "ADAPTADORES 12V", keywords: ["adaptador 12v"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "2", grupoNome: "ELÉTRICA E ENERGIA", subgrupoId: "3", subgrupoNome: "EXTENSÕES AUTOMOTIVAS", keywords: ["extensao automotiva"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "3", grupoNome: "CONFORTO E PROTEÇÃO", subgrupoId: "1", subgrupoNome: "CAPAS DE BANCO", keywords: ["capa banco"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "3", grupoNome: "CONFORTO E PROTEÇÃO", subgrupoId: "2", subgrupoNome: "TAPETES AUTOMOTIVOS", keywords: ["tapete automotivo"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "3", grupoNome: "CONFORTO E PROTEÇÃO", subgrupoId: "3", subgrupoNome: "PROTETORES DE VOLANTE", keywords: ["protetor volante", "capa volante"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "4", grupoNome: "SEGURANÇA", subgrupoId: "1", subgrupoNome: "TRIÂNGULOS", keywords: ["triangulo sinalizacao"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "4", grupoNome: "SEGURANÇA", subgrupoId: "2", subgrupoNome: "LANTERNAS DE EMERGÊNCIA", keywords: ["lanterna emergencia"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "4", grupoNome: "SEGURANÇA", subgrupoId: "3", subgrupoNome: "ACESSÓRIOS DE SEGURANÇA", keywords: ["seguranca automotiva"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "5", grupoNome: "MOBILIDADE ELÉTRICA", subgrupoId: "1", subgrupoNome: "MOTO ELÉTRICA", keywords: ["moto eletrica"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "5", grupoNome: "MOBILIDADE ELÉTRICA", subgrupoId: "2", subgrupoNome: "TRICICLO ELÉTRICO", keywords: ["triciclo eletrico"] },
  { secaoId: "8", secaoNome: "AUTOMOTIVO", grupoId: "5", grupoNome: "MOBILIDADE ELÉTRICA", subgrupoId: "3", subgrupoNome: "PATINETE ELÉTRICO", keywords: ["patinete eletrico"] },

  { secaoId: "9", secaoNome: "ESPORTE E LAZER", grupoId: "1", grupoNome: "FITNESS E EXERCÍCIOS", subgrupoId: "1", subgrupoNome: "TENSORES ELÁSTICOS", keywords: ["tensor elastico"] },
  { secaoId: "9", secaoNome: "ESPORTE E LAZER", grupoId: "1", grupoNome: "FITNESS E EXERCÍCIOS", subgrupoId: "2", subgrupoNome: "ELÁSTICOS DE RESISTÊNCIA", keywords: ["elastico resistencia", "faixa elastica"] },
  { secaoId: "9", secaoNome: "ESPORTE E LAZER", grupoId: "1", grupoNome: "FITNESS E EXERCÍCIOS", subgrupoId: "3", subgrupoNome: "BOLAS", keywords: ["bola"] },
  { secaoId: "9", secaoNome: "ESPORTE E LAZER", grupoId: "1", grupoNome: "FITNESS E EXERCÍCIOS", subgrupoId: "4", subgrupoNome: "BICICLETA ERGOMETRICA", keywords: ["bicicleta ergometrica"] },
  { secaoId: "9", secaoNome: "ESPORTE E LAZER", grupoId: "2", grupoNome: "LAZER E RECREAÇÃO", subgrupoId: "1", subgrupoNome: "BRINQUEDOS EXTERNOS", keywords: ["brinquedo externo"] },
  { secaoId: "9", secaoNome: "ESPORTE E LAZER", grupoId: "2", grupoNome: "LAZER E RECREAÇÃO", subgrupoId: "2", subgrupoNome: "JOGOS AO AR LIVRE", keywords: ["jogo ar livre"] },
  { secaoId: "9", secaoNome: "ESPORTE E LAZER", grupoId: "2", grupoNome: "LAZER E RECREAÇÃO", subgrupoId: "3", subgrupoNome: "INFLÁVEIS", keywords: ["inflavel"] },
  { secaoId: "9", secaoNome: "ESPORTE E LAZER", grupoId: "3", grupoNome: "CAMPING E VIAGEM", subgrupoId: "1", subgrupoNome: "LANTERNAS", keywords: ["lanterna camping"] },
  { secaoId: "9", secaoNome: "ESPORTE E LAZER", grupoId: "3", grupoNome: "CAMPING E VIAGEM", subgrupoId: "2", subgrupoNome: "ACESSÓRIOS PARA CAMPING", keywords: ["camping"] },
  { secaoId: "9", secaoNome: "ESPORTE E LAZER", grupoId: "4", grupoNome: "CICLISMO", subgrupoId: "1", subgrupoNome: "ACESSÓRIOS PARA BICICLETA", keywords: ["acessorio bicicleta", "bike"] },
  { secaoId: "9", secaoNome: "ESPORTE E LAZER", grupoId: "4", grupoNome: "CICLISMO", subgrupoId: "2", subgrupoNome: "SUPORTES E ITENS DE SEGURANÇA", keywords: ["suporte bicicleta", "seguranca bicicleta"] }
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => singularize(token))
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function singularize(token: string): string {
  if (token.endsWith("oes")) return `${token.slice(0, -3)}ao`;
  if (token.endsWith("aes")) return `${token.slice(0, -3)}ao`;
  if (token.endsWith("is")) return `${token.slice(0, -2)}l`;
  if (token.endsWith("res")) return token.slice(0, -1);
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  return token;
}

function scoreEntry(description: string, descriptionTokens: Set<string>, entry: TaxonomyEntry): number {
  let score = 0;
  const sectionTokens = tokenize(entry.secaoNome);
  const groupTokens = tokenize(entry.grupoNome);
  const subgroupTokens = tokenize(entry.subgrupoNome);
  const keywordTokens = (entry.keywords ?? []).flatMap((keyword) => tokenize(keyword));

  for (const token of sectionTokens) {
    if (descriptionTokens.has(token)) score += 1;
  }

  for (const token of groupTokens) {
    if (descriptionTokens.has(token)) score += 3;
  }

  for (const token of subgroupTokens) {
    if (descriptionTokens.has(token)) score += 6;
  }

  for (const token of keywordTokens) {
    if (descriptionTokens.has(token)) score += 8;
  }

  const normalizedDescription = normalizeText(description);
  const subgroupPhrase = normalizeText(entry.subgrupoNome);
  const groupPhrase = normalizeText(entry.grupoNome);

  if (subgroupPhrase && normalizedDescription.includes(subgroupPhrase)) {
    score += 15;
  }

  if (groupPhrase && normalizedDescription.includes(groupPhrase)) {
    score += 5;
  }

  return score;
}

export function classifyKadiaCad(...descriptions: Array<string | undefined>): ProductClassification | null {
  const mergedDescription = descriptions.filter(Boolean).join(" ");
  const descriptionTokens = new Set(tokenize(mergedDescription));

  if (descriptionTokens.size === 0) {
    return null;
  }

  let bestEntry: TaxonomyEntry | null = null;
  let bestScore = 0;

  for (const entry of TAXONOMY) {
    const score = scoreEntry(mergedDescription, descriptionTokens, entry);

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (!bestEntry || bestScore < 8) {
    return null;
  }

  const confidenceLevel =
    bestScore >= 24 ? "high" : bestScore >= 14 ? "medium" : "low";

  return {
    secaoId: bestEntry.secaoId,
    grupoId: bestEntry.grupoId,
    subgrupoId: bestEntry.subgrupoId,
    confidence: bestScore,
    confidenceLevel,
    matchedPath: `${bestEntry.secaoNome} > ${bestEntry.grupoNome} > ${bestEntry.subgrupoNome}`
  };
}
