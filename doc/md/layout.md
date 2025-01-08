
YXCollectionView 的 layout 属性决定了单元节点在屏幕上的排列方式。  

通过 YXLayout 作为布局管理器，YXCollectionView 将所有的布局和展示逻辑交给了 YXLayout 来处理。也就是说，YXCollectionView 本身不负责具体的布局实现，而是通过将布局职责委托给 YXLayout 来实现布局的完全解耦。  

这一设计的最大优势是布局的独立性：你可以针对不同的需求实现不同的布局样式，无论是 TableView、网格布局，还是其他任意排列方式，都可以通过自定义 YXLayout 来实现。  

每种布局都可以独立封装，不同布局之间相互隔离，互不依赖。使用时只需引入对应的布局规则，极大地提高了灵活性和可重用性。而且，由于布局规则是独立设计的，它们还可以很方便地被导出并分享给其他开发者使用。  

---  

## YXIndexPath  

YXIndexPath 代表了索引，常见的列表组件里数据索引一般来说都是直接用整形来定义的 (例如 index: number)，但是因为 YXCollectionView 有分区的概念，所以是封装了一个对象用来表示节点的位置索引，通俗的来说，YXIndexPath 表示的是第 section 个区里的第 item 个节点，这个 item 就可以看做是 index，只不过表示的是在某个区内的位置  

## YXLayoutAttributes  

YXLayoutAttributes 用来描述节点的 UI 相关的信息，在自定义布局的时候，需要对应的创建多个 YXLayoutAttributes 对象来描述节点的 UI 信息，假如说列表一共需要展示 100 条内容，那就是需要创建 100 个 YXLayoutAttributes 对象来描述这 100 个节点的位置，YXLayoutAttributes 通过关键属性 indexPath 记录这个布局对象对应的是哪个节点，通过 frame 属性记录这个节点实际的 UI 位置，总结来说 YXLayoutAttributes 就是它**表示了第 indexPath 个节点的位置是 frame**  
  
需要注意的是，frame 是一个 Rect 类型，同时包含了节点的位置和大小信息，**参考坐标系为左上角原点坐标系**，也就是 origin (0,0) 的位置表示节点紧靠列表左边/上边的位置，举个例子，假如现在需要在列表内以左上角为起点垂直方向排列 3 个大小为 200x100 的节点，不考虑间距边距的情况下，最终的节点位置用 frame 来表示应该为:  
```ts
1. (0, 0, 200, 100)
2. (0, 100, 200, 100)
3. (0, 200, 200, 100)
```

如果需要给节点之间加上一个间距 10，则最终节点位置用 frame 来表示应该为:  
```ts
1. (0, 0, 200, 100)
2. (0, 110, 200, 100)
3. (0, 220, 200, 100)
```

如果还需要给节点加一个左边距 20 的话，则最终节点位置用 frame 来表示应该为:  
```ts
1. (20, 0, 200, 100)
2. (20, 110, 200, 100)
3. (20, 220, 200, 100)
```  

  
把上面的例子通过代码实现的话就是:   
```ts
// 伪代码 

let spacing = 10 // 节点之间间距
let section_left = 20 // 左边距
let itemSize = new math.Size(200, 100) // 节点大小

let attr1 = new YXLayoutAttributes()
attr1.indexPath = new YXIndexPath(0, 0) // 第 0 个区第 0 个节点
attr1.frame = new math.Rect(section_left, 0, itemSize.width, itemSize.height) // 这个节点的位置

let attr2 = new YXLayoutAttributes()
attr2.indexPath = new YXIndexPath(0, 1) // 第 0 个区第 1 个节点
attr2.frame = new math.Rect(section_left, attr1.frame.yMax + spacing, itemSize.width, itemSize.height) // 这个节点的位置

let attr3 = new YXLayoutAttributes()
attr3.indexPath = new YXIndexPath(0, 2) // 第 0 个区第 2 个节点
attr3.frame = new math.Rect(section_left, attr2.frame.yMax + spacing, itemSize.width, itemSize.height) // 这个节点的位置
```  

## YXLayout  

YXLayout 主要就是负责管理自定义的 YXLayoutAttributes 对象，在 YXLayout 里面无需考虑节点管理，开发者可以放心的定义全部的 YXLayoutAttributes 对象以描述所有的节点位置  

可以参考项目里的 table-layout 的实现，了解 YXLayout 的基本工作流程  

## table-layout  

1. [实现一个类似 TableView 的布局规则 table-layout (了解基本的自定义布局流程)](./table-layout-1.md)  
1. [使 table-layout 支持不同高度的节点 (了解如何支持不同大小的单元项)](./table-layout-2.md)  
1. [使 table-layout 支持分区配置 (了解组件的分区概念)](./table-layout-3.md)  
1. [使 table-layout 支持区头/区尾配置 (简单了解 supplementary 补充视图概念)](./table-layout-4.md)  
1. [使 table-layout 支持区头/区尾吸附效果 (了解如何实时更新节点布局属性)](./table-layout-5.md)  
1. [table-layout 性能优化 (了解组件的性能缺陷)](./table-layout-6.md)  

以上就是 table-layout 完整的实现过程，有兴趣的可以了解一下  


