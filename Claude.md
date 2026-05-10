Here's a Claude Code prompt you can paste directly into your terminal:


Look at the TarsiAssistant component (search for it in the codebase). I want to remove all spacing and padding around the ant/mascot image so it sits flush with no gaps. Specifically:

Remove any padding, margin, or gap on the parent View or TouchableOpacity wrapping the image
Make sure the image itself has no implicit spacing — set margin: 0 and padding: 0 on the image style
The bubble should still flex and fill remaining space, but the ant image should be flush with no surrounding whitespace
Do not change the image dimensions (ANT_W, ANT_H), animations, or any other logic — only fix the spacing around the image