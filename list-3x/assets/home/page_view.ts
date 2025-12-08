import { _decorator, Component, Label } from 'cc';
import { YXCollectionView } from '../lib/yx-collection-view';
import { PageLayout } from '../lib/page-layout';
const { ccclass, property } = _decorator;

@ccclass('page_view')
export class page_view extends Component {
    protected start(): void {
        const listComp = this.node.getChildByName('list').getComponent(YXCollectionView)

        listComp.recycleInterval = 0
        listComp.ignoreScrollEndedDuringAutoScroll = true
        listComp.numberOfItems = () => {
            return 3
        }
        listComp.cellForItemAt = (indexPath, collectionView) => {
            let index = indexPath.row % 3
            const cell = collectionView.dequeueReusableCell(`cell`)
            cell.getChildByName('label').getComponent(Label).string = `左右滑动切换页面` + `\n` + `当前页面: ` + `${index}`
            return cell
        }

        let layout = new PageLayout()
        // 这个属性用来控制是否循环滚动  
        layout.loop = true
        listComp.layout = layout

        listComp.reloadData()
    }
}

