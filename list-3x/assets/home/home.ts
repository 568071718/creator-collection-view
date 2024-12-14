import { _decorator, Component, Label, math, Node } from 'cc';
import { YXCollectionView } from '../lib/yx-collection-view';
import { YXTableLayout } from '../lib/yx-table-layout';
const { ccclass, property } = _decorator;

class Data {
    id: number
}

@ccclass('home')
export class home extends Component {

    @property(YXCollectionView)
    listComp: YXCollectionView = null

    testData: Data[] = []

    protected start(): void {

        // 绑定数据源
        this.listComp.numberOfItems = () => this.testData.length
        this.listComp.cellForItemAt = (indexPath, collectionView) => {
            const rowData = this.testData[indexPath.item]
            const cell = collectionView.dequeueReusableCell(`cell`)
            cell.getChildByName('label').getComponent(Label).string = `${indexPath}`
            return cell
        }

        // 确定布局方案  
        let layout = new YXTableLayout()
        layout.spacing = 20
        layout.itemSize = new math.Size(400, 100)
        this.listComp.layout = layout

        this.receivedData()
    }

    /**
     * 模拟收到数据  
     */
    receivedData() {
        this.testData = []
        for (let index = 0; index < 1000; index++) {
            let data = new Data()
            data.id = index
            this.testData.push(data)
        }

        // 刷新列表
        this.listComp.reloadData()
    }
}

