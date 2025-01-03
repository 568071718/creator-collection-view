![title.png](./doc/imgs/title.png)


> YXCollectionView 的主要作用是管理数据的渲染和展示。为了提升性能，它通过节点池机制高效地复用单元节点，这使得它具备虚拟列表的特性。但需要特别指出的是，YXCollectionView 的核心业务不仅限于虚拟列表的管理，它更侧重于布局排列的全面控制。  
> 
> *<small>简介由 AI 生成</small>*
> 

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
* 多种单元 cell 节点类型  
* 列表嵌套  
* 分区概念  
* [布局解耦(组件核心)](./doc/md/layout.md)  

## 使用  

* 注册 cell，通过 register() 注册列表内可能用到的节点类型，可多次注册    

```ts
this.listComp.register(`cell1`, () => instantiate(<your cell prefab>))
this.listComp.register(`cell2`, () => instantiate(<your cell prefab>))
this.listComp.register(`cell3`, () => instantiate(<your cell prefab>))
this.listComp.register(`cell4`, () => instantiate(<your cell prefab>))
this.listComp.register(`cell5`, () => instantiate(<your cell prefab>))
```

* 绑定数据源，更新节点数据   

```ts
// this.testData 是模拟数据  

// 确定列表内一共需要显示多少条内容   
this.listComp.numberOfItems = () => this.testData.length;

this.listComp.cellForItemAt = (indexPath, collectionView) => {
    // 通过下标可以获取到对应的数据
    const data = this.testData[indexPath.item]

    // 通过标识符获取重用池内的节点
    const cell = collectionView.dequeueReusableCell(`your cell identifier`)

    // 更新数据显示
    const comp = cell.getComponent(CommonCell)
    comp.label.string = `${indexPath}`
    comp.randomIcon()
    comp.randomShapeColor()
    comp.randomStar()
    comp.randomLevelSign()

    return cell // 返回这个节点给列表显示
}
```

* 确定布局方案  

```ts
let layout = new YXTableLayout()
layout.spacing = 20
layout.itemSize = new math.Size(400, 100)
this.listComp.layout = layout
```

以上几个步骤不分先后，确保都配置好就好，数据源绑定/布局对象配置好之后，在需要刷新的时候执行 reloadData  

```ts
// 更新列表
this.listComp.reloadData()
```  

---  

补充: 附张通过编辑器内注册 cell 的截图  

![img.png](./doc/imgs/editor-panel.png)

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


