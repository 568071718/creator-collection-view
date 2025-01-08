![title.png](./doc/imgs/title.png)

---   

## 开发环境
* 2.x  
    引擎版本：Cocos Creator **2.4.13**  
    编程语言：TypeScript
* 3.x  
    引擎版本：Cocos Creator **3.8.0**  
    编程语言：TypeScript  

## 基本特性  

* 节点回收复用(虚拟列表模式)  
* 分帧预加载节点(非虚拟列表模式)  
* 多种 cell 节点类型  
* 列表嵌套  
* 分区概念  
* supplementary 补充视图概念  
* 多种 supplementary 节点类型  
* [布局解耦(组件核心)](./doc/md/layout.md)  

## table-layout  

* 仿 TableView 样式，仅支持垂直方向排列  
* 支持设置不同的行高  
* 支持分区模式  
* 支持添加区头/区尾  
* 支持区头/区尾悬浮吸附效果  
* [在线演示](https://568071718.github.io/cocos-creator-build/collection-view/table-layout/)  

## 使用  

```ts
listComp.numberOfItems = () => 10000
listComp.cellForItemAt = (indexPath, collectionView) => {
    const cell = collectionView.dequeueReusableCell(`cell`)
    cell.getChildByName('label').getComponent(Label).string = `${indexPath}`
    return cell
}

let layout = new YXTableLayout()
layout.spacing = 20
layout.rowHeight = 100
listComp.layout = layout

listComp.reloadData()
```

## 更多接口  

* 内部 ScrollView 组件  
```ts
let isScrolling = this.listComp.scrollView.isScrolling()
let isAutoScrolling = this.listComp.scrollView.isAutoScrolling()
this.listComp.scrollView.brake = 0.8
this.listComp.scrollView.bounceDuration = 0.25
this.listComp.scrollView.scrollToOffset(new math.Vec2(0, 200))
// ... 可以直接使用更多 ScrollView 属性或者方法  
```

* 开启分区  
```ts
// 注意: 分区需要自定义 YXLayout 支持  
this.listComp.numberOfSections = () => 2 // 设置列表分 2 个区排列
this.listComp.numberOfItems = (section, collectionView) => {
    if (section == 0) {
        return 10 // 第 1 个区返回 10 条数据
    }
    if (section == 1) {
        return 20 // 第 2 个区返回 20 条数据
    }
    return 0 // 默认情况  
}
```

* 节点显示状态回调  
```ts
this.listComp.onCellDisplay = (cell, indexPath, collectionView) => {
    log(`onCellDisplay: ${indexPath}`)
}
this.listComp.onCellEndDisplay = (cell, indexPath, collectionView) => {
    log(`onCellEndDisplay: ${indexPath}`)
}
```

* 滚动至指定位置  
```ts
let indexPath = new YXIndexPath(0, 2) // 要滚动到的节点索引
this.listComp.scrollTo(indexPath)
```

* 预加载相关接口  
```ts
this.listComp.preloadNodesLimitPerFrame = 2 // 每帧加载多少个节点
this.listComp.preloadProgress = (current, total) => {
    log(`加载进度: ${current}/${total}`)
}
```

## 相关链接  
* [Github](https://github.com/568071718/creator-collection-view)    
* [Gitee](https://gitee.com/568071718/creator-collection-view)  
* [查看声明文件](./doc/declarations/yx-collection-view.d.ts)  
* [旧版文档](https://gitee.com/568071718/creator-collection-view-doc)  


