

YXCollectionView 的 layout 属性决定了单元节点在屏幕上的排列方式。  

通过 YXLayout 作为布局管理器，YXCollectionView 将所有的布局和展示逻辑交给了 YXLayout 来处理。也就是说，YXCollectionView 本身不负责具体的布局实现，而是通过将布局职责委托给 YXLayout 来实现布局的完全解耦。  

这一设计的最大优势是布局的独立性：你可以针对不同的需求实现不同的布局样式，无论是 TableView、网格布局，还是其他任意排列方式，都可以通过自定义 YXLayout 来实现。  

每种布局都可以独立封装，不同布局之间相互隔离，互不依赖。使用时只需引入对应的布局规则，极大地提高了灵活性和可重用性。而且，由于布局规则是独立设计的，它们还可以很方便地被导出并分享给其他开发者使用。  

---  

## 基础概念  

要开始编写代码，首先需要知道两个概念，一个是 YXIndexPath，一个是 YXLayoutAttributes  

YXIndexPath 代表了索引，常见的列表组件里数据索引一般来说都是直接用整形来定义的 (例如 index: number)，但是因为 YXCollectionView 有分区的概念，所以是封装了一个对象用来表示节点的位置索引，通俗的来说，YXIndexPath 表示的是第 section 个区里的第 item 个节点，这个 item 就可以看做是 index，只不过表示的是在某个区内的位置    

YXLayoutAttributes 用来描述节点的 UI 相关的信息，在自定义布局的时候，需要对应的创建多个 YXLayoutAttributes 对象来记录节点的 UI 信息，假如说列表一共需要展示 100 条内容，那就是需要创建 100 个 YXLayoutAttributes 对象来描述这 100 个节点的位置，YXLayoutAttributes 通过关键属性 indexPath 记录这个布局对象对应的是哪个节点，通过 frame 属性记录这个节点实际的 UI 位置，用白话来形容 YXLayoutAttributes 就是它**表示了第 indexPath 个节点的位置是 frame**  

  
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
  
了解 YXLayoutAttributes 之后应该就明白**自定义布局其实就是自己实现所有的 YXLayoutAttributes 布局对象，确定每个节点对应的位置**，确定了节点的位置后，列表就会按照提供的位置来排列所有的节点  

  
## 如何实现    

组件定义了一个抽象类 YXLayout，这个类拦截了一些 YXCollectionView 行为，可以通过重写这个类的方法来创建/更新单元节点的布局属性或者定制一些行为表现  

可以参考项目里的 table-layout 的实现，初步了解 YXLayout 的工作流程    

```ts
import { math, UITransform, warn } from "cc";
import { YXBinaryLayout, YXCollectionView, YXIndexPath, YXLayoutAttributes } from "./yx-collection-view";


enum _yx_table_layout_alignment {

    /**
     * 单元节点相对列表居中  
     */
    CENTER,

    /**
     * 单元节点紧靠列表左侧  
     */
    LEFT,

    /**
     * 单元节点紧靠列表右侧  
     */
    RIGHT,
}

/**
 * 想要了解自定义布局的，可以看看这个类，这个类实现了一个基础的 table view 的布局样式，相对来说比较简单  
 * 
 * - 支持不同的节点大小  
 * - 支持调整对齐方式  
 * - 不支持分区布局  
 * - 不支持水平方向滚动，仅支持垂直方向滚动  
 * - 不支持多列布局，仅支持单列布局 
 * - 支持调整上下边距/间距  
 */
export class YXTableLayout extends YXBinaryLayout {

    /**
     * 单元格大小   
     */
    itemSize: math.Size | ((indexPath: YXIndexPath, layout: YXTableLayout, collectionView: YXCollectionView) => math.Size) = new math.Size(100, 100)

    /**
     * 间距  
     */
    spacing: number = 0

    /**
     * 上边距
     */
    top: number = 0

    /**
     * 下边距
     */
    bottom: number = 0

    /**
     * 对齐方式  
     */
    alignment: _yx_table_layout_alignment = YXTableLayout.Alignment.CENTER
    static Alignment = _yx_table_layout_alignment

    prepare(collectionView: YXCollectionView): void {
        // 设置列表的滚动方向  
        if (collectionView.scrollDirection == YXCollectionView.ScrollDirection.HORIZONTAL) {
            warn(`YXTableLayout 只支持垂直方向排列`)
        }
        collectionView.scrollView.horizontal = false
        collectionView.scrollView.vertical = true

        let contentSize = collectionView.node.getComponent(UITransform).contentSize.clone()
        let attrs = []

        let maxY = this.top

        // 获取列表内一共需要展示多少数据  
        let numberOfItems = collectionView.getNumberOfItems(0)
        for (let row = 0; row < numberOfItems; row++) {

            // 生成对应的 indexPath，并通过 indexPath 获取节点大小  
            // 这里是不支持分区所以不考虑 section 的情况，section 默认就是 0，支持的分区的情况可以回头看 flow-layout 的实现  
            let indexPath = new YXIndexPath(0, row)
            let itemSize = this.itemSize instanceof Function ? this.itemSize(indexPath, this, collectionView) : this.itemSize

            // 生成布局属性对象，并按照 table view 的规则确定好节点的位置    
            let attributes = new YXLayoutAttributes(indexPath)
            attributes.frame = new math.Rect()
            attributes.frame.size = itemSize
            attributes.frame.y = maxY + (row > 0 ? this.spacing : 0)
            attributes.frame.x = 0
            if (this.alignment == _yx_table_layout_alignment.RIGHT) {
                attributes.frame.x = (contentSize.width - attributes.frame.width)
            }
            if (this.alignment == _yx_table_layout_alignment.CENTER) {
                attributes.frame.x = (contentSize.width - attributes.frame.width) * 0.5
            }
            attrs.push(attributes)
            maxY = attributes.frame.yMax
        }

        maxY += this.bottom

        // 保存起来给列表组件使用  
        this.attributes = attrs

        // 确定滚动范围的总大小  
        contentSize.height = Math.max(contentSize.height, maxY)
        this.contentSize = contentSize
    }

    initOffset(collectionView: YXCollectionView): void {
        // 首次更新数据，滚动至列表顶部  
        collectionView.scrollView.scrollToTop()
    }
}
```

[了解更多 YXLayout 接口](../declarations/yx-collection-view.d.ts)  


