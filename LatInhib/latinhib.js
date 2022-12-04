/*

Dr John-Stuart Brittain
Birmingham University, UK
Last revision Sept 2021

*/

function LatInhib() {

	this.canvas = document.querySelector('#latInhib');
	this.resscale = 3;		// Resolution scaling only (default 300px wide)
	this.canvas.width = this.resscale*this.canvas.width;
	this.canvas.height = this.resscale*this.canvas.height;

	this.display = {
		displacement : true
	};

	this.c = this.canvas.getContext('2d');
	this.c.font = (this.resscale*6) + "px Arial";

	this.xoffset = this.canvas.width/2.0;
	this.yoffset = this.canvas.height/2.0;
	this.colorFill = "black";//'C4CDFF';
	this.colorStroke = "black";//'3C5AFF';

	// Neuron model
	Nunits = 10;
	this.neuron = {
		soma : {
				x: 300,
				y : 250,
				threshold : 12.0
			},
		axon : { length: 60 },
		synapse_weight_scaling : 1.0,
		dendrite : []
	};
	var number_of_dendrites = 8;
	for (var i = 0; i < number_of_dendrites; i++) {
		this.neuron.dendrite.push({
			x : this.neuron.soma.x - 80,//50.0*Math.cos(0.5*Math.PI*(i+0.5)/number_of_dendrites - 0.25*Math.PI),
			y : this.neuron.soma.y + 250*((i+0.5)/number_of_dendrites-0.5),//50.0*Math.sin(1.0*Math.PI*(i+0.5)/number_of_dendrites - 0.5*Math.PI),
			weight : 0,
			colour : "white"
		});
	}
	this.neuron.dendrite[0].weight = 1;
	this.buttonOffset = 100;
	this.buttonSize = 10;

	// Motor unit array
	this.MUbar = {
		xoffset : [ ],
		yoffset : [ ],
		xspacing : [ ],
		dt : [ ],
		MUs : [ ]		// 2D for two muscles
	};
	for (var i = 0; i < number_of_dendrites; i++) {
		this.MUbar.xoffset.push(this.neuron.dendrite[i].x - 65);
		this.MUbar.yoffset.push(this.neuron.dendrite[i].y);
		this.MUbar.xspacing.push(4);
		this.MUbar.dt.push(0.25);
	}
	for (var k = 0; k < Nunits; k++) {
		Mulist = [];
		for (var i = 0; i < number_of_dendrites; i++)
			Mulist.push([0]);
		this.MUbar.MUs.push(Mulist);
	}

	// Motor Unit action potential time-series
	this.MUAPs = {
		N : Math.round( this.MUbar.MUs.length/this.MUbar.dt[0] ),
		APs : []
	};
	this.MUAPscaling = [];
	for (var k = 0; k < this.MUAPs.N; k++) {
		Mulist = [];
		for (var i = 0; i < number_of_dendrites; i++)
			Mulist.push([0]);
		this.MUAPs.APs.push(Mulist);
		this.MUAPscaling.push(3.0);
	}

	// Treat elbow forces as springs
	this.elbow = {
		forces : [],
		resultant_force : new Array(this.MUAPs.N)
	};
	for (var i = 0; i < this.MUAPs.N; i++) {
		this.elbow.forces[i] = new Array(number_of_dendrites);
	}

	// Draw parameters
	this.draw_sample = 0;
	this.draw_N = this.MUAPs.N;
	this.draw_time = undefined;
	this.draw_start_time = Date.now();
	this.draw_rate = 0.01;

	this.hitTime = 0;
	this.hitCount = 0;
	this.hitLocation = 0;
	this.hitTargetCount = 10;
	this.hitMisses = 0;
	this.hitLocs = [];
	this.onScreenResult = "";
	this.onScreenText = "Click the spike trains to turn on/off";

	this.mousedown = function( event ) {
		const rect = this.canvas.getBoundingClientRect();
		const x = (event.clientX - rect.left)*this.canvas.width/rect.width;
	    const y = (event.clientY - rect.top)*this.canvas.height/rect.height;

	    // Off-canvas
		if (( x < 0 ) || ( x > this.canvas.width ) || ( y < 0 ) || ( y > this.canvas.height) )
			return;

		// Find clicked-on AP and switch state
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
			if ( (y < (this.MUbar.yoffset[n]+15)) && (y > (this.MUbar.yoffset[n]-15)) ) {
				var index = Math.round((x - this.MUbar.xoffset[n]-0.5*this.MUbar.xspacing[n])/this.MUbar.xspacing[n]);
				//console.log(this.MUbar.MUs[index][n]);
				this.MUbar.MUs[index][n] = 1 - this.MUbar.MUs[index][n];
			}
		}

		// Recalculate response
		this.calcMUAPresponse();
	}

	this.resetTimer = function() {
		//
	}

	this.init = function() {
		this.resetMUs();
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ )
			this.neuron.dendrite[n].weight = 0;
		this.MUbar.MUs[3][0] = 1;
		this.neuron.dendrite[0].weight = 1;
		this.calcMUAPresponse();
	}

	this.resetMUs = function() {
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
			for ( var k = 0; k < this.MUbar.MUs.length; k++ ) {
				this.MUbar.MUs[k][n] = 0;
			}
		}
		this.calcMUAPresponse();
	}

	this.randomMUs = function() {
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
			this.neuron.dendrite[n].weight = 0;
			for ( var k = 0; k < this.MUbar.MUs.length; k++ ) {
				if ( Math.random() < 0.25 ) {
					this.MUbar.MUs[k][n] = 1;
					this.neuron.dendrite[n].weight = 1;
				}
				else
					this.MUbar.MUs[k][n] = 0;
			}
		}
		this.calcMUAPresponse();
	}

	this.syncMUs = function() {
		this.resetMUs();
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
			this.MUbar.MUs[3][n] = 1;
			this.neuron.dendrite[n].weight = 1;
		}
		this.calcMUAPresponse();
	}

	this.restartTime = function() {
		this.draw_time = 0;
		this.draw_sample = 0;
		this.draw_start_time = Date.now();
	}

	this.setDrawRate = function( rate ) {
		latInhib.draw_rate = rate;
		this.restartTime();
	}
	
	this.calcMUAPresponse = function() {
		var tau = 2.5;
		var max_contraction = 5.0;
		
		// Reset
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
			// Reset MUAPs
			for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
				this.MUAPs.APs[tn][n] = 0;
			}
		}
		// Repeat for each muscle
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
			// Recurse motor units for each point in time
			for ( var k = 0; k < this.MUbar.MUs.length; k++ ) {
				// Only include time-points past the MU activation time
				if ( this.MUbar.MUs[k][n] == 1 ) {
					firingtime = k;//*this.MUbar.dt[n]);
					firingN = Math.round(k/this.MUbar.dt[n]);
					for ( var tn = firingN; tn < this.MUAPs.N; tn++ ) {
						// Add MUAP for each unit in turn
						t = tn*this.MUbar.dt[n];
						this.MUAPs.APs[tn][n] = Math.min( max_contraction, this.MUAPs.APs[tn][n] + (1-Math.pow(0.025,t-firingtime))*Math.exp( -(t-firingtime)/tau ) );
					}
				}
			}
		}

		// Turn dendrites on/off
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
			this.neuron.dendrite[n].weight = 0;
			for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
				if ( this.MUAPs.APs[tn][n] > 0 ) {
					this.neuron.dendrite[n].weight = 1;
				}
			}
		}

		// Calculate force on joint and joint angle
		var tauSoma = 0.99;
		for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
			this.elbow.resultant_force[tn] = 0;
		}
		for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
			// Calculate force applied by both muscles at that moment in time
			for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
				this.elbow.forces[tn][n] = this.MUAPscaling[n]*this.MUAPs.APs[tn][n];// - springk*resultant_displacement;
				this.elbow.resultant_force[tn] += this.neuron.synapse_weight_scaling*this.neuron.dendrite[n].weight*this.elbow.forces[tn][n];
			}
			if ( this.elbow.resultant_force[tn] > this.neuron.soma.threshold ) {
				this.elbow.resultant_force[tn] = 30;
				for ( var kn = (tn+1); kn < this.MUAPs.N; kn++ )
					this.elbow.resultant_force[kn] = -15*Math.exp( -(kn*this.MUbar.dt[0]-tn*this.MUbar.dt[0])/tauSoma );
				tn++;
			}
		}
	}

	this.drawnow = function() {

		var resscale = this.resscale;
		this.draw_time = Date.now() - this.draw_start_time;
		this.draw_sample = Math.round( this.draw_rate*this.draw_time/this.MUbar.dt[0] );
		if ( this.draw_sample >= this.draw_N ) {
			this.restartTime();
		}

		// Reset Canvas
		this.c.clearRect(0,0,this.canvas.width,this.canvas.height);
		this.c.fillStyle = this.colorFill;
		this.c.strokeStyle = this.colorStroke;
		this.c.lineWidth = 2;

		// Draw bounding box
		this.c.beginPath();
		this.c.rect( this.neuron.soma.x-200, 60, 300, this.canvas.height-100 );
		this.c.stroke();

		// Draw second bounding box
		var box2x = 400;
		this.c.beginPath();
		this.c.fillStyle = "#F5F5F5";
		this.c.strokeStyle = "black";
		this.c.lineWidth = 2;
		this.c.fillRect( box2x+this.neuron.soma.x-200, 60, 300, this.canvas.height-100 );
		this.c.rect( box2x+this.neuron.soma.x-200, 60, 300, this.canvas.height-100 );
		this.c.stroke();
		this.c.fillStyle = this.colorFill;

		// Draw axon
		this.c.moveTo(this.neuron.soma.x,this.neuron.soma.y);
		this.c.lineTo(this.neuron.soma.x+this.neuron.axon.length,this.neuron.soma.y);
		this.c.stroke();

		// Draw second axon
		this.c.moveTo(box2x+this.neuron.soma.x,this.neuron.soma.y);
		this.c.lineTo(box2x+this.neuron.soma.x+this.neuron.axon.length,this.neuron.soma.y);
		this.c.stroke();

		// Draw dendrites
		this.c.strokeStyle = "black";
		for ( var k = 0; k < this.neuron.dendrite.length; k++ ) {
			if ( this.neuron.dendrite[k].weight == 0 ) {
				this.c.strokeStyle = "lightgrey";
			} else if ( this.neuron.dendrite[k].weight > 0 ) {
				this.c.strokeStyle = "black"
			} else {
				this.c.strokeStyle = "red";
			}
			
			this.c.beginPath();
			// First box
			this.c.moveTo(this.neuron.soma.x,this.neuron.soma.y);
			this.c.lineTo(this.neuron.dendrite[k].x,this.neuron.dendrite[k].y);
			// Second box
			this.c.moveTo(box2x+this.neuron.soma.x,this.neuron.soma.y);
			this.c.lineTo(box2x+this.neuron.dendrite[k].x,this.neuron.dendrite[k].y);
			// Draw
			this.c.fill();
			this.c.stroke();
		}
		this.c.strokeStyle = this.colorStroke;

		// Draw dendrite switches
		/*this.c.strokeStyle = "darkblue";
		for ( var k = 0; k < this.neuron.dendrite.length; k++ ) {
			this.c.fillStyle = this.neuron.dendrite[k].colour;
			this.c.beginPath();
			this.c.moveTo(this.neuron.soma.x - this.buttonOffset + this.buttonSize,this.neuron.dendrite[k].y);
			this.c.arc(this.neuron.soma.x - this.buttonOffset,this.neuron.dendrite[k].y,this.buttonSize,0,Math.PI*2,false);
			this.c.fill();
			this.c.stroke();
		}
		this.c.strokeStyle = this.colorStroke;*/

		// Draw soma
		this.c.beginPath();
		this.c.fillStyle = "white";
		this.c.arc(this.neuron.soma.x,this.neuron.soma.y,26,0,Math.PI*2,false);
		this.c.fill();
		this.c.stroke();

		// Draw second soma
		this.c.beginPath();
		this.c.fillStyle = "white";
		this.c.arc(box2x+this.neuron.soma.x,this.neuron.soma.y,26,0,Math.PI*2,false);
		this.c.fill();
		this.c.stroke();

		// Draw motor unit activators
		var symbol = "";
		this.c.beginPath();
		this.c.fillStyle = "black";
		this.c.fillText(this.onScreenText, resscale*4, resscale*8);
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
			for ( var k = 0; k < this.MUbar.MUs.length; k++ ) {
				if ( this.MUbar.MUs[k][n] == 1 ) {
					this.c.fillStyle = "black";
					symbol = "|";
				} else {
					this.c.fillStyle = "green";
					symbol = ".";
				}
				this.c.fillText(symbol, this.MUbar.xoffset[n] + this.MUbar.xspacing[n]*k, this.MUbar.yoffset[n]);
			}
		}

		// Draw spike (soma)
		var yscaling = 15.0;
		this.c.beginPath();
		this.c.strokeStyle = "black";
		this.c.lineWidth = 1;
		this.c.moveTo( this.neuron.soma.x-20, this.neuron.soma.y+10 );
		// Only include time-points past the MU activation time
		for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
			//this.c.lineTo( this.MUbar.xoffset[0] + this.MUbar.xspacing[0]*tn*this.MUbar.dt[0], this.MUbar.yoffset[0] - yscaling*this.MUAPs.APs[tn][0] );
			this.c.lineTo( this.neuron.soma.x-20 + this.MUbar.xspacing[0]*tn*this.MUbar.dt[0], this.neuron.soma.y+10 - 30*(this.elbow.resultant_force[tn] > this.neuron.soma.threshold) );
		}
		this.c.stroke();

		// Draw MUAP train
		var yscaling = 15.0;
		this.c.beginPath();
		this.c.strokeStyle = "black";
		this.c.lineWidth = 1;
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
			this.c.moveTo( box2x+this.MUbar.xoffset[n], this.MUbar.yoffset[n] );
			// Only include time-points past the MU activation time
			for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
				this.c.lineTo( box2x+this.MUbar.xoffset[n] + this.MUbar.xspacing[n]*tn*this.MUbar.dt[n], this.MUbar.yoffset[n] - yscaling*this.MUAPs.APs[tn][n] );
			}
		}
		this.c.stroke();

		// Draw Soma resultant PSP
		this.c.beginPath();
		this.c.strokeStyle = "black";
		this.c.lineWidth = 1;
		this.c.moveTo( box2x+this.neuron.soma.x-20, this.neuron.soma.y+10 );
		// Only include time-points past the MU activation time
		for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
			this.c.lineTo( box2x+this.neuron.soma.x-20 + this.MUbar.xspacing[0]*tn*this.MUbar.dt[0], this.neuron.soma.y+10- this.elbow.resultant_force[tn] );
		}
		this.c.stroke();

		// Soma threshold for firing
		this.c.beginPath();
		this.c.strokeStyle = "black";
		this.c.lineWidth = 0.5;
		this.c.setLineDash([2, 2]);
		this.c.moveTo( box2x+this.neuron.soma.x-20, this.neuron.soma.y+10-this.neuron.soma.threshold );
		this.c.lineTo( box2x+this.neuron.soma.x-20 + this.MUbar.xspacing[0]*(this.MUAPs.N-1)*this.MUbar.dt[0], this.neuron.soma.y+10-this.neuron.soma.threshold );
		this.c.stroke();
		this.c.setLineDash([]);

		// Timer
		this.c.beginPath();
		this.c.strokeStyle = "black";
		this.c.lineWidth = 1.0;
		this.c.moveTo( this.MUbar.xoffset[0] + this.MUbar.xspacing[0]*this.draw_sample*this.MUbar.dt[0], 120 );
		this.c.lineTo( this.MUbar.xoffset[0] + this.MUbar.xspacing[0]*this.draw_sample*this.MUbar.dt[0], 370 );
		this.c.stroke();

		// Labels
		this.c.fillStyle = "black";
		this.c.fillText("Spikes", this.neuron.soma.x+35, 80);
		this.c.fillText("Post-synaptic potentials /", box2x+this.neuron.soma.x-110, 80);
		this.c.fillText("Membrane potential", box2x+this.neuron.soma.x-70, 96);
		
	}
}



// *** Main code block ***

var latInhib = new LatInhib();

uiResetAPs = function( ) {
	latInhib.init();
}

uiRandomAPs = function( ) {
	latInhib.randomMUs();
}

uiSyncAPs = function( ) {
	latInhib.syncMUs();
}

window.addEventListener('resize',
	function() {
		latInhib.init();
	})

addEventListener('mousemove',
	function(event) {
		//latInhib.mousemove(event);
	});

addEventListener('mousedown',
	function(event) {
		latInhib.mousedown(event);
	});

animate = function() {
	requestAnimationFrame(animate);
	latInhib.drawnow();
}

latInhib.init();
animate();
