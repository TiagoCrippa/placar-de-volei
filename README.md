# 🏐 Placar · Sem Técnica F.C.

Placar de vôlei do **Sem Técnica F.C.**, feito em HTML, CSS e JavaScript puros, sem dependências e sem etapa de build. Funciona no celular, no tablet e na TV (tela cheia).

## Funcionalidades

- **Regras oficiais**
  - **Quadra:** melhor de 5, sets de 25, tie-break de 15, 2 tempos por set.
  - **Praia:** melhor de 3, sets de 21, tie-break de 15, 1 tempo por set.
  - Todo set precisa de **2 pontos de vantagem** (25×24 não fecha, vai a 26×24…).
- **Saque automático:** quem marca o ponto passa a sacar, com a bolinha girando no time que está sacando.
- **Set point / Match point** aparecem sozinhos.
- **Troca de lado automática:** a cada set. Na quadra, também aos 8 pontos do tie-break. Na praia, a cada 7 pontos (5 no tie-break).
- **Pedido de tempo** com cronômetro e apito no final.
- **Desfazer ilimitado** (até 200 ações): ponto errado, troca errada ou até "nova partida" sem querer.
- **Parciais** de cada set e tela de fim de set e de fim de jogo (com confete quando o Sem Técnica ganha 🎉).
- **Compartilhar resultado** (WhatsApp etc.) com o placar e as parciais.
- O placar **é salvo no navegador**: se fechar a aba ou a bateria acabar, o jogo continua de onde parou.
- **Tela sempre ligada** no celular durante o jogo (Wake Lock).
- Pode ser **instalado como app** ("Adicionar à tela inicial").
- Nomes dos times, pontos por set, número de sets e tempos são configuráveis (⚙).

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| `A` ou `←` | +1 para o time da esquerda |
| `L` ou `→` | +1 para o time da direita |
| `Z` / `M` | −1 esquerda / direita |
| `U`, `Backspace` ou `Ctrl+Z` | Desfazer |
| `S` | Trocar lados |
| `N` | Começar o próximo set |
| `F` | Tela cheia |

## Publicar no GitHub Pages

1. Crie um repositório (ex.: `placar-sem-tecnica`) e suba todos os arquivos desta pasta:
   ```bash
   git init
   git add .
   git commit -m "Placar Sem Técnica F.C."
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/placar-sem-tecnica.git
   git push -u origin main
   ```
2. No GitHub, vá em **Settings → Pages**.
3. Em **Source**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e clique em **Save**.
4. Em cerca de 1 minuto o placar fica disponível em
   `https://SEU-USUARIO.github.io/placar-sem-tecnica/`

## Rodar localmente

Basta abrir o `index.html` no navegador. Para testar no celular pela rede local:

```bash
python3 -m http.server 8080
# acesse http://IP-DO-SEU-PC:8080 no celular
```

## Estrutura

```
├── index.html            # estrutura da página
├── style.css             # visual (cores do escudo)
├── app.js                # regras do vôlei e lógica do placar
├── manifest.webmanifest  # permite instalar como app
└── assets/
    ├── logo.png          # escudo do time
    └── icon-192.png      # ícone do app
```

Para trocar as cores, edite as variáveis no topo do `style.css` (`--gold`, `--orange`, `--blue`…).
