# FormBro UI Style Guide

## 1. 设计原则

### 核心理念
- **简洁优先**：避免过度设计，减少不必要的边框和装饰
- **层次清晰**：通过间距、颜色和大小建立视觉层级
- **一致体验**：深浅模式保持相同的交互逻辑和视觉权重
- **渐进披露**：根据用户操作状态动态展示内容

## 2. 颜色系统

### 深色主题
```css
:root[data-theme="dark"] {
  /* 主色调 */
  --primary: #4F7FFF;
  --primary-hover: #6690FF;
  --primary-active: #3D6FEF;
  
  /* 背景层级 */
  --bg-base: #0f1419;         /* 最底层背景 */
  --bg-elevated: #1a1f2e;     /* 卡片/面板背景 */
  --bg-input: #242938;        /* 输入框背景 */
  --bg-hover: rgba(255, 255, 255, 0.05);
  
  /* 边框 */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.1);
  --border-strong: rgba(255, 255, 255, 0.2);
  
  /* 文字 */
  --text-primary: #e7e9ea;
  --text-secondary: #8b92a8;
  --text-muted: #536471;
  
  /* 功能色 */
  --success: #198754;
  --warning: #ffc107;
  --danger: #dc3545;
  --info: var(--primary);
}
```

### 浅色主题
```css
:root[data-theme="light"] {
  /* 主色调 */
  --primary: #4F7FFF;
  --primary-hover: #3D6FEF;
  --primary-active: #2B5DDD;
  
  /* 背景层级 */
  --bg-base: #f5f7fa;
  --bg-elevated: #ffffff;
  --bg-input: #f8f9fa;
  --bg-hover: rgba(0, 0, 0, 0.02);
  
  /* 边框 */
  --border-subtle: rgba(0, 0, 0, 0.05);
  --border-default: rgba(0, 0, 0, 0.1);
  --border-strong: rgba(0, 0, 0, 0.2);
  
  /* 文字 */
  --text-primary: #1a1a1a;
  --text-secondary: #6c757d;
  --text-muted: #adb5bd;
  
  /* 功能色 */
  --success: #198754;
  --warning: #ffc107;
  --danger: #dc3545;
  --info: var(--primary);
}
```

## 3. 字体系统

### 字体层级
```css
:root {
  /* 字体大小 */
  --text-xs: 12px;    /* 辅助信息、版本号 */
  --text-sm: 14px;    /* 正文、按钮、表单 */
  --text-base: 16px;  /* 重要内容 */
  --text-lg: 18px;    /* 小标题 */
  --text-xl: 20px;    /* 页面标题 */
  
  /* 字重 */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  
  /* 行高 */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}

/* 应用示例 */
.page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
}

.body-text {
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}

.helper-text {
  font-size: var(--text-xs);
  color: var(--text-muted);
}
```

## 4. 间距系统

### 8px 基准网格
```css
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
}

/* 组件间距规范 */
.navbar { 
  padding: 12px 24px; 
}

.card {
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.form-group {
  margin-bottom: var(--spacing-md);
}

.button-group {
  gap: 12px;
}
```

## 5. 组件样式

### 导航栏
```css
.navbar {
  background: var(--bg-elevated);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-tab {
  padding: 8px 16px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  border-radius: 6px;
  transition: all 0.2s;
}

.nav-tab.active {
  color: var(--primary);
  background: rgba(79, 127, 255, 0.1);
}
```

### 按钮
```css
/* 基础按钮样式 */
.btn {
  padding: 10px 20px;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* 主按钮 */
.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(79, 127, 255, 0.3);
}

/* 次要按钮 */
.btn-secondary {
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

/* 小按钮 */
.btn-sm {
  padding: 6px 12px;
  font-size: var(--text-xs);
}

/* 图标按钮 */
.btn-icon {
  padding: 8px;
  width: 36px;
  height: 36px;
}
```

### 表单元素
```css
/* 输入框 */
.input {
  width: 100%;
  padding: 10px 16px;
  font-size: var(--text-sm);
  background: var(--bg-input);
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-primary);
  transition: all 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(79, 127, 255, 0.1);
}

/* 下拉选择 */
.select {
  appearance: none;
  background-image: url('data:image/svg+xml,...'); /* 下拉箭头 */
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}

/* 复选框 */
.checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}
```

### 卡片
```css
.card {
  background: var(--bg-elevated);
  border-radius: 12px;
  padding: var(--spacing-lg);
  /* 深色模式下不需要阴影，浅色模式需要 */
}

[data-theme="light"] .card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-subtle);
}

[data-theme="dark"] .card {
  border: 1px solid var(--border-subtle);
}
```

### 进度条
```css
.progress-bar {
  height: 6px;
  background: var(--bg-input);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width 0.3s ease;
  border-radius: 3px;
}

/* 带动画的进度条 */
.progress-fill.animated {
  background: linear-gradient(
    90deg,
    var(--primary) 0%,
    var(--primary-hover) 50%,
    var(--primary) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s linear infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

## 6. 状态处理

### 空状态
```css
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.empty-state-icon {
  opacity: 0.3;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.empty-state p {
  font-size: var(--text-sm);
}
```

### 加载状态
```css
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 成功/错误消息
```css
.alert {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: var(--text-sm);
  display: flex;
  align-items: center;
  gap: 8px;
}

.alert-success {
  background: rgba(25, 135, 84, 0.1);
  border: 1px solid rgba(25, 135, 84, 0.2);
  color: var(--text-primary);
}

.alert-error {
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgba(220, 53, 69, 0.2);
  color: var(--text-primary);
}
```

## 7. 图标系统

### 推荐图标库
使用 lucide-react 图标，尺寸规范：
- 导航图标：16px
- 按钮图标：16px
- 状态图标：20px
- 空状态图标：48px

### 常用图标映射
```jsx
// 导航
<FileText size={16} />    // Form Filling
<Users size={16} />       // Jobbank Inviter
<LogOut size={16} />      // Exit
<Settings size={16} />    // Settings

// 操作
<Plus size={16} />        // Add
<Send size={16} />        // Start Inviting
<RefreshCw size={16} />   // Refresh
<Trash2 size={16} />      // Delete

// 状态
<CheckCircle size={20} /> // Success
<AlertCircle size={20} /> // Warning
<XCircle size={20} />     // Error
<Loader size={20} />      // Loading
```

## 8. 交互规范

### 过渡动画
```css
/* 标准过渡 */
.transition-default {
  transition: all 0.2s ease;
}

/* 慢速过渡（用于复杂动画） */
.transition-slow {
  transition: all 0.3s ease;
}

/* 快速过渡（用于即时反馈） */
.transition-fast {
  transition: all 0.15s ease;
}
```

### 悬停效果
- 按钮：提升 1px + 阴影
- 卡片：轻微提升背景色
- 链接：颜色变深
- 输入框：显示边框

### 焦点状态
- 所有可交互元素必须有明显的焦点状态
- 使用 box-shadow 而非 outline
- 确保键盘导航友好

## 9. 响应式设计

### 断点
```css
/* 移动端优先 */
@media (min-width: 640px) { /* 平板 */ }
@media (min-width: 1024px) { /* 桌面 */ }
@media (min-width: 1280px) { /* 大屏 */ }
```

### 触摸目标
- 最小点击区域：44x44px
- 按钮间距：至少 8px
- 移动端适当增大交互元素

## 10. 可访问性

### 对比度要求
- 正文文字：至少 4.5:1
- 大文字（18px+）：至少 3:1
- 交互元素：至少 3:1

### ARIA 标签
- 所有图标按钮必须有 aria-label
- 使用语义化 HTML
- 提供键盘导航支持

## 11. 文案规范

### 标题
- 使用动词开头："Select Account" 而非 "Account Selection"
- 保持简洁：最多 3-4 个词
- 避免技术术语

### 辅助文字
- 提供清晰的操作指引
- 使用友好的语气
- 错误信息要有建设性

### 按钮文案
- 使用动作词："Start", "Add", "Save"
- 包含图标增强理解
- 保持一致的语言风格