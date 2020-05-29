var socket_production = 'https://phantom-demo.herokuapp.com';
var url_production = "https://phantom-demo.herokuapp.com/buses";

var socket_dev = 'http://localhost:7777';
var url_dev = "http://localhost:7777/buses";

var socket = io(socket_production);
console.log(socket);
let canvas = new fabric.Canvas('canvas');
let currentBus = "";

const getBuses = async function () {
    const response = await fetch(url_production);
    const data = await response.json();
    if (!data.err) {
        const listOfBusses = data.response.map(bus => {
            return JSON.parse(bus.busDetails);
        })
        return listOfBusses;
    }

};

const viewBus = function (busID) {
    currentBus = busID;
    canvas = new fabric.Canvas('canvas');
    const busName = document.getElementById("bus-name");
    busName.innerHTML = `<h4> Bus ${busID} tracking info loading...</h4>`;
    document.getElementById("canvas").classList.remove('hidden');
    displayCanvas();
    socket.emit('TRACK', {
        busID
    });
}

const displayBuses = async function () {
    const data = await getBuses();
    const listOfBusDiv = document.getElementById("bus-list");
    let listOfBusDiv_HTML;
    if (data) {
        listOfBusDiv_HTML = `
                <table>
                    <tr>
                       <th>Bus - ID</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>`;
        
        data.map((bus, index) => {
            listOfBusDiv_HTML += `
                    <tr>
                        <td>${bus.id}</td>
                        <td>${bus.status}</td>
                        <td><button onclick="viewBus('${bus.id}')">View Bus</button></td>
                    </tr>
            `;
        });

        listOfBusDiv_HTML += `</table>`;
        listOfBusDiv.innerHTML += listOfBusDiv_HTML;
    }
}();

const displayCanvas = function () {
    const rect = new fabric.Rect({
        left: 100,
        top: 100,
        fill: 'red',
        width: 20,
        height: 10,
        angle: 120
    });

    const startingPoint = new fabric.Circle({
        radius: 5, fill: 'black', left: 50, top: 100, name: 'origin-point'
    });

    const destinationPoint = new fabric.Circle({
        radius: 5, fill: 'black', left: 1130, top: 100, name :'destination-point'
    });

    const route = new fabric.Line([55, 105, 1135, 105], {
        selectable: false,
        stroke: 'black',
        name : 'road'
    })

    canvas.add(startingPoint);
    canvas.add(destinationPoint);
    canvas.add(route);
}

socket.on('bus_updates', (data) => {
    const busDetails = JSON.parse(data.busDetails);
    if (busDetails.id === currentBus) {
        const busName = document.getElementById("bus-name");
        busName.innerHTML = `<h4> You are tracking Bus ${busDetails.id} </h4>`;
        updateCanvas(busDetails.coverage, busDetails.route.miles, busDetails.route.origin, busDetails.route.destination, busDetails.route.busStops);
    }
})

const updateCanvas = function (currentCoverage, miles, originPlace, destinationPlace, busStops){

    const currentPlaceOnCanvas = scaleValue(currentCoverage, [0,miles], [50,1130]) // 1080 is the length of the route on canvas.

    const startingPointName = new fabric.Text(originPlace, {
        fontWeight: 'normal',
        fontSize: 20,
        left: 20,
        top: 50,
    });

    const destinationPointName = new fabric.Text(destinationPlace, {
        fontWeight: 'normal',
        fontSize: 20,
        left: 1100,
        top: 50,
    });
    

    if (canvas.getObjects()[3]) {
        canvas.getObjects()[3].text = originPlace;
        // canvas.renderAll();
    } else {
        canvas.add(startingPointName);
    }

    if (canvas.getObjects()[4]) {
        canvas.getObjects()[4].text = destinationPlace;
        // canvas.renderAll();
    } else {
        canvas.add(destinationPointName);
    }

    if (currentPlaceOnCanvas) {
        fabric.Image.fromURL('http://127.0.0.1:5500/assets/bus-left-min.png', function (img) {

            if (canvas.getObjects()[5]) {
                canvas.getObjects()[5].set({
                    left: currentPlaceOnCanvas
                });
                canvas.renderAll();
            } else {
                img.set({
                    height: 25,
                    top: 105,
                    left: currentPlaceOnCanvas,
                    angle: -180,
                    flipY: true
                });
                canvas.add(img);
            }

            if (canvas.getObjects().length === 6) { // Draw all busStops
                let theBusStop;
                let theBusStopName;
                busStops.map(busStop => {
                    const left = scaleValue(busStop.miles, [0, miles], [50, 1130]);
                    theBusStop = new fabric.Triangle({
                        width: 20,
                        height: 30,
                        fill: 'blue',
                        left: left,
                        top: 105
                    })

                    theBusStopName = new fabric.Text(busStop.name, {
                        fontWeight: 'normal',
                        fontSize: 20,
                        left: left - 30,
                        top: 135,
                    })

                    canvas.add(theBusStop, theBusStopName);
                })
            }
            
        });
    }
    
    // // Get the number of bus stops
    const busStopsCount = busStops.length;
    const canvasObjectsCount = canvas.getObjects().length;
    if (canvasObjectsCount > 6) {
        
        const additionalObjectsCount = canvasObjectsCount - 6;

        if (additionalObjectsCount == (busStops.length * 2)) { // Update the existing busStops
            let index = 1;
            
            for (let i = 0; i < busStops.length; i++) {

                const currentBusStopPlaceOnCanvas = scaleValue(busStops[i].miles, [0, miles], [50, 1130]);
                const currentBusStopName = busStops[i].name;
                canvas.getObjects()[5+index].set({
                    left: currentBusStopPlaceOnCanvas
                });

                canvas.getObjects()[5 + index + 1].set({
                    left: currentBusStopPlaceOnCanvas-30,
                    text: currentBusStopName
                });

                index += 2;
            }
        }
    }

    canvas.renderAll();
}

/* Scale a value from one range to another
* Example of use:
*
* // Convert 33 from a 0-100 range to a 0-65535 range
* var n = scaleValue(33, [0,100], [0,65535]);
*
* // Ranges don't have to be positive
* var n = scaleValue(0, [-50,+50], [0,65535]);
*
* Ranges are defined as arrays of two values, inclusive
*
* The ~~ trick on return value does the equivalent of Math.floor, just faster.
*
*/
const scaleValue = function (value, from, to){
    var scale = (to[1] - to[0]) / (from[1] - from[0]);
    var capped = Math.min(from[1], Math.max(from[0], value)) - from[0];
    return ~~(capped * scale + to[0]);
}
