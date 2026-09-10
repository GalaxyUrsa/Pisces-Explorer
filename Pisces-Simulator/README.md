# GLORYS 理想化中尺度涡旋嵌入

`embed_idealized_eddy.py` 在 GLORYS 背景场上叠加由海表高度定义、满足地转平衡的三维理想涡旋。原始 `thetao` 和 `so` 不变，修改量为 `uo` 和 `vo`；输入含 `zos` 时也会同步叠加，输入不含 `zos` 时则跳过该变量。输出会根据修改后的 `uo`、`vo` 重新保存 `current_speed` 和 `current_direction`，与 Pisces-Ocean-Infer 使用相同约定。

## 安装与运行

```bash
pip install numpy xarray netCDF4 matplotlib

python embed_idealized_eddy.py input.nc output_eddy.nc \
  --longitude 135.0 --latitude 30.0 \
  --radius-km 75 --amplitude-cm 10 \
  --influence-depth-m 700 \
  --kind gaussian --vertical-decay exponential \
  --figure eddy_diagnostics.png
```

默认变量/坐标名为 `zos uo vo thetao so longitude latitude depth`，其中 `zos` 可缺省。非标准名称可映射：

```bash
python embed_idealized_eddy.py input.nc output.nc ... \
  --names-json "{\"zos\":\"sla\",\"depth\":\"lev\"}"
```

输入中心必须位于网格内。命令行按题设约束半径为 50–100 km、正 SSH 振幅为 5–20 cm、影响深度为 500–1000 m。南北半球的旋转方向会由科氏参数自动改变。赤道附近地转近似失效，脚本会拒绝 `|f| < 1e-5 s-1` 的网格。

## 物理构造

Gaussian 模式采用

```text
eta'(r) = A exp[-r²/(2R²)]
```

其中 `A` 是中心 SSH 异常，`R` 是 e-folding 尺度。Rankine 模式从经典切向流速形状（核内正比于 `r`，核外正比于 `1/r`）积分得到连续 SSH，并在 `3R` 外截为零。

局地球面距离用于计算水平结构。随后对离散网格上的 SSH 求导，并采用以涡心纬度为参考的局地 `f`-plane：

```text
u' = -(g/f) ∂eta'/∂y
v' =  (g/f) ∂eta'/∂x
f0 = 2 Omega sin(eddy-center latitude)
```

这使涡旋邻域内的压力梯度与科氏力平衡，并允许输入大区域跨越赤道，只要涡心不在赤道附近。正的 SSH 核在北半球产生反气旋，负核产生气旋。三维速度为

```text
(u', v')(x,y,z) = (u', v')(x,y,0) F(z)
F(z) = exp(-|z|/H)
```

`H` 是 `--influence-depth-m`；也可选择 Gaussian 垂向衰减。这里“影响深度”是衰减尺度而不是硬截止深度。

SSH 异常始终用于计算地转流速和绘图；没有 `zos` 时，它只是中间诊断量，不会写成新的数据变量。输出从原数据集复制全局属性、变量属性及主要压缩/填充值编码，并在 `history` 和 `idealized_eddy_parameters` 中记录处理参数。陆地上的原始 NaN 会在相加时保留。

`current_speed` 的单位为 `m s-1`；`current_direction` 表示海水流向，正北为 0°、顺时针增加，静水点和无效点为 `NaN`。如果输入文件已有这两个字段，输出会按模拟后的流速分量重新计算并覆盖，避免沿用背景场的旧派生值。

诊断图的四个面板分别显示人工 SSH 异常、表层异常流速矢量、相对涡度 `dv/dx-du/dy`，以及涡心处修改前后的温盐剖面；后两组剖面应完全重合，因为该工作流不修改水团性质。
