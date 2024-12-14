// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import { YXCollectionView } from "../lib/yx-collection-view";
import { YXTableLayout } from "../lib/yx-table-layout";

const { ccclass, property } = cc._decorator;

class Data {
    id: number
}

@ccclass
export default class NewClass extends cc.Component {

    @property(YXCollectionView)
    listComp: YXCollectionView = null

    testData: Data[] = []

    protected start(): void {

        // 绑定数据源
        this.listComp.numberOfItems = () => this.testData.length
        this.listComp.cellForItemAt = (indexPath, collectionView) => {
            const rowData = this.testData[indexPath.item]
            const cell = collectionView.dequeueReusableCell(`cell`)
            cell.getChildByName('label').getComponent(cc.Label).string = `${indexPath}`
            return cell
        }

        // 确定布局方案  
        let layout = new YXTableLayout()
        layout.spacing = 20
        layout.itemSize = new cc.Size(400, 100)
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
