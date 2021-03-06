var EVENT_NAMES = {
    "ENTER": "enter",
    "LEAVE": "leave",
    "PASS": "pass",
    "BEFOR_ROLL": "befor-roll",
    "AFTER_ROLL": "after-roll",
    "BEFOR_GO": "befor-go",
    "AFTER_GO": "after-go",
    "BEFOR_INVEST": "befor-invest",
    "AFTER_INVEST": "after-invest",
    "PLAYER_OVER": "player-over",
    "GAME_OVER": "game-over"
};
var PLAYER_STATUS = {
    "STOP": "stop",
    "ROLL": "roll",
    "GO": "go",
    "INVEST": "invest",
    "WAIT": "wait"
};
var OPTION = {
    "STOP": 0,
    "ROLL": 1,
    "GO": 2,
    "BUY": 4,
    "BUILD": 8,
    "UPGRADE": 16,
    "NOINVEST": 32,
    "CARD": 1024
};

function _trigger(name, args) {
    if (this.events.hasOwnProperty(name)) {
        var cbs = this.events[name];
        for (var i = 0; i < cbs.length; i++) {
            if (cbs[i]) cbs[i].apply(this, args);
        }
    }
}

function _bind(event, cb) {
    if (!this.events.hasOwnProperty(event)) {
        this.events[event] = [];
    }
    this.events[event].push(cb);
}

function _unbind(event, cb) {
    if (this.events.hasOwnProperty(event)) {
        this.events[event].splice(this.events[event].indexOf(cb), 1);
    }
}

function game(players, lands, buildingTypes) {
    var m = new map(lands, buildingTypes);
    this.map = m;
    this.players = players;

    for (var i = 0; i < players.length; i++) {
        players[i].game = this;
        players[i].map = m;
        if (players[i].location == null) {
            this.init();
        }
        if (players[i].status != PLAYER_STATUS.STOP) {
            if (this.currentPlayerIndex > 0) {
                players[this.currentPlayerIndex].status = PLAYER_STATUS.STOP;
            }
            this.currentPlayerIndex = i;
        }
    }
    if (this.currentPlayerIndex < 0) {
        this.currentPlayerIndex = 0;
        this.currPlayer().status = PLAYER_STATUS.ROLL;
    }
}
game.prototype.map = null;
game.prototype.players = [];
game.prototype.currentPlayerIndex = -1;
game.prototype.init = function() {
    var landNames = this.map.allLandNames;
    var dis = landNames.length / this.players.length;
    var offset = Math.floor(Math.random() * landNames.length);
    for (var i = 0; i < this.players.length; i++) {
        var landName = landNames[(dis * i + offset) % landNames.length];
        this.players[i].location = landName;
        this.map.locate(landName).players.push(this.players[i].name);
    }
};
game.prototype.currPlayer = function() {
    var currentPlayer = this.players[this.currentPlayerIndex % this.players.length];
    return currentPlayer;
};
game.prototype.nextPlayer = function() {
    var currentPlayer = this.players[this.currentPlayerIndex % this.players.length];
    currentPlayer.status = PLAYER_STATUS.STOP;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    currentPlayer = this.players[this.currentPlayerIndex];
    currentPlayer.status = PLAYER_STATUS.ROLL;
    return currentPlayer;
};

function player() {
    this.events = {};
}
player.prototype.name = null;
player.prototype.money = 0;
player.prototype.isBroken = false;
player.prototype.location = null;
player.prototype.status = PLAYER_STATUS.STOP;
player.prototype.stickRound = 0;
player.prototype.forwardCount = 0;

player.prototype.game = null;
player.prototype.map = null;

player.prototype.events = null;
player.prototype.trigger = _trigger;
player.prototype.bind = _bind;
player.prototype.unbind = _unbind;

player.prototype.pay = function(n, force) {
    var p = this;
    var land = p.map.locate(p.location);
    if (n <= 0) {
        return p;
    }
    if (p.money >= n) {
        p.money -= n;
    } else if (force) {
        p.isBroken = true;
        p.location = null;
        p.game.trigger(EVENT_NAMES.PLAYER_OVER, [p, land]);
        p.game.nextPlayer();
        land.players.splice(land.players.indexOf(p.name), 1);
        p.game.players.splice(p.game.players.indexOf(p), 1);
        if (p.game.players.length == 1) {
            p.game.trigger(EVENT_NAMES.GAME_OVER, [p.game.players[0], p.map.locate(p.game.players[0].location)]);
        }
    }
};

player.prototype.roll = function() {
    var p = this;
    var land = p.map.locate(p.location);
    if (p.status == PLAYER_STATUS.ROLL) {
        if (p.stickRound > 0) {
            p.stickRound--;
        } else {
            p.trigger(EVENT_NAMES.BEFOR_ROLL, [p, land]);
            p.forwardCount = 0;
            p.forwardCount += Math.ceil(Math.random() * 6);
            p.trigger(EVENT_NAMES.AFTER_ROLL, [p, land]);
            p.status = PLAYER_STATUS.GO;
        }
    }
    return p;
};
player.prototype.go = function() {
    var p = this;
    var land = p.map.locate(p.location);
    if (p.forwardCount == 0) {

        return p;
    }
    if (p.status == PLAYER_STATUS.GO) {
        p.trigger(EVENT_NAMES.BEFOR_GO, [p, land]);
        land.players.splice(land.players.indexOf(p.name), 1);
        land.trigger(EVENT_NAMES.LEAVE, [p, land]);
        while (p.forwardCount != 0) {
            if (p.forwardCount > 0) {
                land = p.map.locate(land.nextLand);
                p.forwardCount--;
            } else {
                land = p.map.locate(land.prevLand);
                p.forwardCount++;
            }
            if (p.forwardCount == 0) {
                p.location = land.name;
                land.players.push(p.name);
                land.trigger(EVENT_NAMES.ENTER, [p, land]);
            } else {
                land.trigger(EVENT_NAMES.PASS, [p, land]);
            }
        }
        p.trigger(EVENT_NAMES.AFTER_GO, [p, land]);
        p.status = PLAYER_STATUS.INVEST;
    }
    return p;
};
player.prototype.wcid = function() {
    var p = this;
    var land = p.map.locate(p.location);
    var opt = OPTION.NONE;
    switch (p.status) {
        case PLAYER_STATUS.STOP:
            break;
        case PLAYER_STATUS.ROLL:
            opt += OPTION.ROLL + OPTION.CARD;
            break;
        case PLAYER_STATUS.GO:
            opt += OPTION.GO;
            return p.go().wcid();
        case PLAYER_STATUS.INVEST:
            opt += OPTION.NOINVEST;
            if (land.owner == null) {
                opt += OPTION.BUY;
            } else if (land.owner == p.name && land.building == null) {
                opt += OPTION.BUILD;
            } else if (land.building != null && land.building.owner == p.name && land.building.level < land.building.buildCost.length) {
                opt += OPTION.UPGRADE;
            } else {
                return p.noinvest().wcid();
            }
            break;
        case PLAYER_STATUS.WAIT:
            opt += OPTION.CARD;
            break;
    }
    return opt;
};
player.prototype.buy = function() {
    var p = this;
    var land = p.map.locate(p.location);
    if (p.status == PLAYER_STATUS.INVEST && land.owner == null && p.money >= land.price) {
        p.trigger(EVENT_NAMES.BEFOR_INVEST, [p, land]);

        p.pay(land.price);
        land.owner = p.name;

        p.trigger(EVENT_NAMES.AFTER_INVEST, [p, land]);
        p.status = PLAYER_STATUS.WAIT;
    }
    return p;
};
player.prototype.build = function(buildingTypeName) {
    var p = this;
    var land = p.map.locate(p.location);
    var buildingType = p.map.buildingTypesMap[buildingTypeName];
    if (p.status == PLAYER_STATUS.INVEST && land.owner == p.name && p.money >= buildingType.buildCost[0] && (land.planTypes == null || land.planTypes == [] || land.planTypes.indexOf(buildingType.type) >= 0) && (land.banTypes == null || land.banTypes == [] || land.banTypes.indexOf(buildingType.type) < 0)) {
        p.trigger(EVENT_NAMES.BEFOR_INVEST, [p, land]);

        p.pay(buildingType.buildCost[0]);
        var b = new building(buildingType.type, buildingType.buildCost, buildingType.customCost, buildingType.events);
        b.owner = p.name;
        b.location = p.location;
        land.building = b;
        p.map.buildings.push(b);

        p.trigger(EVENT_NAMES.AFTER_INVEST, [p, land]);
        p.status = PLAYER_STATUS.WAIT;
    }
    return p;
};
player.prototype.upgrade = function() {
    var p = this;
    var land = p.map.locate(p.location);
    if (p.status == PLAYER_STATUS.INVEST && land.building != null && land.building.owner == p.name && land.building.level < land.building.buildCost.length && p.money >= land.building.buildCost[land.building.level]) {
        p.trigger(EVENT_NAMES.BEFOR_INVEST, [p, land]);

        p.pay(land.building.buildCost[land.building.level]);
        land.building.level++;

        p.trigger(EVENT_NAMES.AFTER_INVEST, [p, land]);
        p.status = PLAYER_STATUS.WAIT;
    }
    return p;
};
player.prototype.noinvest = function() {
    var p = this;
    var land = p.map.locate(p.location);
    p.status = PLAYER_STATUS.WAIT;
    return p;
};
player.prototype.usecard = function(cardno) {
    var p = this;
    var land = p.map.locate(p.location);
    // card logic
    return p;
};
player.prototype.done = function() {
    var p = this;
    var land = p.map.locate(p.location);
    p.game.nextPlayer();
    return p;
};

function map(lands, buildingTypes) {
    this.lands = lands;
    this.landsMap = {};
    this.allLandNames = [];
    for (var i = 0; i < lands.length; i++) {
        this.landsMap[lands[i].name] = lands[i];
        this.allLandNames.push(lands[i].name);
    }
    this.buildingTypes = buildingTypes;
    this.buildingTypesMap = {};
    for (var i = 0; i < buildingTypes.length; i++) {
        this.buildingTypesMap[buildingTypes[i].type] = buildingTypes[i];
    }
    this.buildings = [];
}
map.prototype.lands = null;
map.prototype.landsMap = null;
map.prototype.allLandNames = null;
map.prototype.buildingTypes = null;
map.prototype.buildingTypesMap = null;
map.prototype.buildings = null;
map.prototype.locate = function(name) {
    if (this.landsMap.hasOwnProperty(name)) {
        return this.landsMap[name];
    }
    return null;
}

function land() {
    this.players = [];
    this.events = {};
}
land.prototype.name = null;
land.prototype.price = 0;
land.prototype.planTypes = [];
land.prototype.banTypes = [];
land.prototype.nextLand = null;
land.prototype.prevLand = null;

land.prototype.owner = null;
land.prototype.building = null;
land.prototype.players = [];

land.prototype.events = null;
land.prototype.trigger = _trigger;
land.prototype.bind = _bind;
land.prototype.unbind = _unbind;

function building(type, buildCost, customCost, events) {
    this.buildCost = buildCost;
    this.customCost = customCost;
    this.events = {};
    if (events) {
        for (var evt in events) {
            this.bind(evt, events[evt]);
        }
    }
}
building.prototype.type = null;
building.prototype.level = 1;
building.prototype.buildCost = [];
building.prototype.customCost = [];
building.prototype.owner = null;
building.prototype.location = null;

building.prototype.events = null;
building.prototype.trigger = _trigger;
building.prototype.bind = _bind;
building.prototype.unbind = _unbind;


module.exports = {
    "game": game,
    "player": player,
    "land": land,
    "building": building,
    "const": {
        "EVENT_NAMES": EVENT_NAMES,
        "PLAYER_STATUS": PLAYER_STATUS
    }
};