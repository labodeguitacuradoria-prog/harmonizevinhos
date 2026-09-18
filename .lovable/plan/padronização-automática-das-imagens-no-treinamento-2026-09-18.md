# Padronização automática das imagens no treinamento

## Resultado
- Detectar margens internas excessivas nas imagens dos rótulos, inclusive fundos pretos ou brancos.
- Recortar apenas essas margens e reenquadrar a garrafa em uma área vertical padronizada.
- Preservar a garrafa inteira, com folga visual, sem ampliar até cortar.
- Aplicar a mesma regra à prévia do gestor e à ficha aberta pela equipe.
- Manter a imagem original como alternativa quando a análise automática não puder ser feita.

## Detalhes técnicos
- Criar um componente reutilizável de imagem normalizada usando canvas no navegador.
- Identificar a cor predominante das bordas, calcular os limites do conteúdo e gerar o enquadramento em memória.
- Validar com o rótulo El Origen e com uma imagem já corretamente enquadrada.
