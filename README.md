# 🚌 Vale-Transporte — Verificação de Rotas

Sistema web para verificação de trajetos e custos de vale-transporte.

---

## Estrutura do projeto

```
vale_transporte/
├── app.py                  # Aplicação principal Streamlit
├── requirements.txt        # Dependências Python
├── data/
│   └── linhas.json         # Banco de dados local das linhas (gerado automaticamente)
└── utils/
    ├── cep_service.py      # Validação (ViaCEP) e geocodificação (Nominatim)
    ├── kml_parser.py       # Extração de coordenadas de arquivos KML
    └── map_service.py      # Geração de mapas com Folium
```

---

## Instalação

```bash
# 1. Clone ou copie a pasta do projeto
cd vale_transporte

# 2. (Opcional) Crie um ambiente virtual
python -m venv venv
source venv/bin/activate      # Linux/Mac
venv\Scripts\activate         # Windows

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Execute o sistema
streamlit run app.py
```

Acesse em: **http://localhost:8501**

---

## Como usar

### Área do usuário — Consulta de Rota
1. Informe o **CEP de origem** e o **CEP de destino**
2. Ajuste os **dias trabalhados** no mês (padrão: 22)
3. Clique em **Buscar Rota** — os pontos aparecem no mapa
4. Selecione as **linhas de ônibus** que compõem o trajeto
5. O custo é calculado automaticamente (ida, ida+volta, mensal)

### Área administrativa
- Acesse pelo menu lateral → **Administração**
- Senha padrão: `admin123` *(altere em `app.py` antes de usar em produção)*
- Cadastre novas linhas informando: nome, valor da passagem e arquivo KML
- Gerencie linhas existentes (visualizar e remover)

---

## Formato KML aceito

O arquivo KML deve conter um elemento `<coordinates>` com pares lon,lat:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <LineString>
        <coordinates>
          -43.1729,-22.9068,0
          -43.1800,-22.9100,0
          -43.1900,-22.9150,0
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>
```

---

## Configurações

| Parâmetro | Local | Padrão |
|-----------|-------|--------|
| Senha admin | `app.py` → `SENHA_ADMIN` | `admin123` |
| Dias trabalhados | Interface | 22 |
| Arquivo de dados | `data/linhas.json` | Criado automaticamente |

---

## Melhorias futuras (já previstas na arquitetura)

- Detecção automática de linhas próximas à origem/destino
- Sugestão de rotas mais baratas
- Distância a pé entre CEP e parada de ônibus
- Autenticação por usuário
- Banco de dados PostgreSQL (substituindo JSON local)
