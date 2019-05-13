import React, { Dispatch } from 'react';
import { IMainListingPollProps, IMainListingPollState, IMainListingPoll, PollIntitalMetadata } from './types/MainListingPoll';
import { VOTING_CORE_ABI, VOTING_ABI } from '../constants/contractABIs';
import { Address } from '../types';
import { IPollCardStatus } from './types/PollCard';
import PollCard from './PollCard';
import { Item, Icon, Loader, Header, Segment, Button } from 'semantic-ui-react';
import { StoreState } from '../store/types';
import { connect } from 'react-redux';
import style from './MainListingPoll.module.css';
import { BlockHeightType } from '../actions/types/eth';
import { pathToFileURL } from 'url';
import { PollActionType } from '../actions/types/poll';
import { setStatistics } from '../actions/poll';

const VOTING_CORE_ADDRESS = process.env.REACT_APP_VOTING_CORE_ADDRESS;

class MainListingPoll extends React.Component<IMainListingPollProps, IMainListingPollState> {
    private contract: any;
    constructor(props: IMainListingPollProps) {
        super(props);
        this.contract = new this.props.web3.eth.Contract(VOTING_CORE_ABI, VOTING_CORE_ADDRESS);
        this.state = {
            amountPolls: null,
            inactivePolls: null,
            activePolls: null,
            inactiveCollapse: true,
            activeCollapse: true
        }
    }

    async refreshPolls() {
        const data = await this.fetchPolls();

        if (data) {
            const { amountPolls, polls } = data;
            const { activePolls, inactivePolls } = this.filePolls(polls);

            this.props.setPollStatistics(amountPolls, activePolls.length);
            this.setState({
                amountPolls,
                activePolls,
                inactivePolls
            });
        }
    }

    checkIfExpired(blockHeight: BlockHeightType) {
        if (this.props.blockHeight === null) {
            return null;
        }

        const isExpired = (this.props.blockHeight >= blockHeight) ? true : false;
        return isExpired;
    }

    filePolls(polls: PollIntitalMetadata[]) {
        const activePolls: PollIntitalMetadata[] = [];
        const inactivePolls: PollIntitalMetadata[] = [];

        polls.forEach(poll => {
            (!poll.isExpired) ? activePolls.push(poll) : inactivePolls.push(poll);
        })

        return {
            activePolls,
            inactivePolls
        }
    }

    async fetchPolls() {
        if (this.props.blockHeight === -1) {
            return null;
        }

        const amountPolls: number = (await this.contract.methods.getAmountVotings().call()).toNumber();
        const polls: PollIntitalMetadata[] = [];
        for (let i = 0; i < amountPolls; i++) {
            const address = await this.contract.methods.getVotingItemByIndex(i).call();
            const contract = new this.props.web3.eth.Contract(VOTING_ABI, address);
            const expiryBlockNumber = (await contract.methods.expiryBlockNumber().call()).toNumber();
            const isExpired = this.checkIfExpired(expiryBlockNumber) as boolean;

            const pollInitialMetadata: PollIntitalMetadata = {
                address,
                contract,
                expiryBlockNumber,
                isExpired
            }
            polls.unshift(pollInitialMetadata);
        }

        return {
            amountPolls,
            polls
        };
    }

    inactiveCollapseToggle() {
        this.setState({
            inactiveCollapse: !this.state.inactiveCollapse
        })
    }

    activeCollapseToggle() {
        this.setState({
            activeCollapse: !this.state.activeCollapse
        })
    }

    async componentDidMount() {
        await this.refreshPolls();
    }
    
    async componentDidUpdate(prevProps: IMainListingPollProps) {
        if (this.props !== prevProps) {
            await this.refreshPolls();
        }
    }

    renderComponent() {
        let state: 'loading' | 'completed' | null = null;

        if (this.state.amountPolls === null) {
            state = 'loading';
        } else {
            state = 'completed';
        }

        switch (state) {
            case 'loading':
                return (
                    <div>
                        <Loader active inline='centered' />
                    </div>
                )
            case 'completed':
                if (this.state.amountPolls && this.state.amountPolls === 0) {
                    return (
                        <Item.Group>
                            <div className={style.center}>
                                <Icon name='archive' size='massive' />
                                <Header>
                                    No poll for now...
                                </Header>
                            </div>
                        </Item.Group>
                    )
                }

                return (
                    <Item.Group divided>
                        <div className={style['inline-container']}>
                            <div className={style['inline-title']}>
                                <Header size='large' content='Active Polls' />
                            </div>
                            {
                                (this.state.activePolls && this.state.activePolls.length !== 0) && (
                                    <div className={style['inline-button']}>
                                        {
                                            (this.state.activeCollapse) ? (
                                                <Button icon onClick={() => this.activeCollapseToggle()}><Icon name='chevron down' size='big' /></Button>
                                            ) : (
                                                <Button icon onClick={() => this.activeCollapseToggle()}><Icon name='chevron up' size='big' /></Button>
                                            )
                                        }
                                        
                                    </div>
                                )
                            }
                        </div>
                        {
                            (this.state.activePolls && this.state.activePolls.length !== 0) ? (
                                <div className={
                                    (this.state.activeCollapse) ? (
                                        [style['collapse'], style['active-list']].join(' ')
                                    ) : (
                                        style['active-list']
                                    )}>
                                <Segment>
                                    {
                                        this.state.activePolls.map(pollInitialMetadata => {
                                            const { address, isExpired, expiryBlockNumber, contract } = pollInitialMetadata;
                                            return (
                                                <PollCard status='active' web3={this.props.web3} address={address} isExpired={isExpired} expiryBlockNumber={expiryBlockNumber} contract={contract} key={address} />
                                            )
                                        })
                                    }
                                </Segment>
                            </div>
                            ) : (
                                <Segment>
                                    <Header textAlign='center' size='small'>
                                        <div>
                                            No polls are available...
                                        </div>  
                                    </Header>
                                </Segment>
                            )
                        }
                        
                        <br />
                        <div className={style['inline-container']}>
                            <div className={style['inline-title']}>
                                <Header size='large' content='Expired Polls' />
                            </div>
                            {
                                (this.state.inactivePolls && this.state.inactivePolls.length !== 0) && (
                                    <div className={style['inline-button']}>
                                        {
                                            (this.state.inactiveCollapse) ? (
                                                <Button icon onClick={() => this.inactiveCollapseToggle()}><Icon name='chevron down' size='big' /></Button>
                                            ) : (
                                                <Button icon onClick={() => this.inactiveCollapseToggle()}><Icon name='chevron up' size='big' /></Button>
                                            )
                                        }
                                        
                                    </div>
                                )
                            }
                        </div>
                        {
                            (this.state.inactivePolls && this.state.inactivePolls.length !== 0) ? (
                                <div className={style['inactive-list']}>
                                    <Segment>
                                        {
                                            this.state.inactivePolls.map(pollInitialMetadata => {
                                                const { address, isExpired, expiryBlockNumber, contract } = pollInitialMetadata;
                                                return (
                                                    <PollCard status='inactive' web3={this.props.web3} address={address} isExpired={isExpired} expiryBlockNumber={expiryBlockNumber} contract={contract} key={address} />
                                                )
                                            })
                                        }  
                                    </Segment>
                                </div>
                            ) : (
                                <Segment>
                                    <Header textAlign='center' size='small'>
                                        <div>
                                            No polls are available...
                                        </div>  
                                    </Header>
                                </Segment>
                            )
                        }
                        
                    </Item.Group>
                    
                )
        }
    }

    render() {
        return this.renderComponent();
    }
}

const mapStateToProps = (state: StoreState, ownProps: IMainListingPoll.IInnerProps): IMainListingPoll.IStateFromProps => {
    return {
        blockHeight: state.ethMisc.blockHeight
    }
}

const mapDispatchToProps = (dispatch: Dispatch<PollActionType>, ownProps: IMainListingPoll.IInnerProps): IMainListingPoll.IPropsFromDispatch => {
    return {
        setPollStatistics: (amount: number, active: number) => dispatch(setStatistics(amount, active))
    }
}

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(MainListingPoll);