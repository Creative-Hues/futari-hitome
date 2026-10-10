# ふたりひとめ 素材

試作で仕上げた絵の素材です。描き直さずに、このまま使ってください。

## animals/
- 6匹(sheep, cat, stoat, axolotl, seal, otter)。頭飾りなし、編み針と青い作品つき。viewBox 0 0 240 240
- 編み針は「手」と一緒に動かす。左は回転中心(102,150)、右は(138,150)で rotate する
- 編んでいる作品は x=104 y=146 幅32 の四角(url(#knit)の編み目模様)。高さを進み具合で変える(試作では4〜44)。色は作品の色に差し替える
- anchors.json:頭飾りをつける位置(動物ごと)と大きさ、最初の頭飾り

## decorations/
- 頭飾り10種類。viewBox -22 -40 44 44 で、(0,0) が頭に触れる点
- 花:tulip, cosmos, hydrangea, sakura, daisy / 葉っぱ:sprout, clover / 海:seaweed, coral, shell
- 部屋の鉢植えの花にも使い回す

## backgrounds/
- room_template.svg:ホームの部屋。色はCSS変数 --wall --floor --curtain --rug --yarn1 --yarn2(すべて単色)
  - --wall-shade --floor-shade --yarn1-shade --yarn2-shade は、選んだ色を少し濃くした色(壁・床は約6〜18%、毛糸は約20%暗く)
  - 鉢植えの花は decorations の花に差し替える(テンプレートは daisy)
- room_palettes.json:色の組み合わせのおすすめ4通り(はじめの部屋・ミント・ラベンダー・そらいろ)
- room_example_*.svg:4通りを色付けした見本
- meadow.svg:編む画面の原っぱ
- 空は朝・昼・夕方・夜で色を変える(素材は昼の色)
