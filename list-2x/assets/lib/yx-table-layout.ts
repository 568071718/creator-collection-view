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
    itemSize: cc.Size | ((indexPath: YXIndexPath, layout: YXTableLayout, collectionView: YXCollectionView) => cc.Size) = new cc.Size(100, 100)

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
            cc.warn(`YXTableLayout 只支持垂直方向排列`)
        }
        collectionView.scrollView.horizontal = false
        collectionView.scrollView.vertical = true

        let contentSize = collectionView.node.getContentSize()
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
            attributes.frame = new cc.Rect()
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


