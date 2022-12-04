/*

Dr John-Stuart Brittain
Birmingham University, UK
Last revision Oct 2021

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
	var number_of_dendrites = 16;
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

	// Receptive fields
	this.RF = {
		n : [         1,       2,       3,      4,       5,       6,       7,       8,       9,      10,      11,     12,      13,      14,      15,     16 ],
		x : [   -1.0689, -0.8095,    -1.4, -1.4384,  0.3252, -0.5549,  1.0703, -1.4115, -0.1022, -0.2414,  0.8192, 0.3129, -0.8649, -0.0301, -0.1649, 0.9277 ],
		y : [    0.2933,  1.1093, -1.0637, -0.2774, -1.4141, -1.3135, -0.0068,  0.9326, -0.7697,  1.3714, -0.6256, 1.1174, -0.7891,  0.0326,  0.5525, 0.8006 ],
		size : [     40,      50,      40,      40,      40,      40,      40,      40,      40,      40,      40,     40,      40,      40,      40,     40 ],
		active : [    0, 	   0, 	    0, 		 0,  	  0, 	   0, 	    0, 		 0, 	  0, 	   0, 	    0, 		0, 		 0, 	  0, 	   0, 	   0 ]
	};
	for (var k = 0; k < this.RF.x.length; k++) {
		this.RF.x[k] *= 75.0;
		this.RF.y[k] *= 75.0;

		this.RF.x[k] += this.neuron.soma.x - 25;
		this.RF.y[k] += this.neuron.soma.y;
		this.RF.size[k] = 40;
	};

	// Stimulus
	this.stimulus = {
		stim_index : 0,
		RFs : [ ]		// Stimuli that will active when pressed
	};

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
	this.onScreenText = "Click the receptive fields to turn neurons on/off";

	this.mousedown = function( event ) {
		const rect = this.canvas.getBoundingClientRect();
		const x = (event.clientX - rect.left)*this.canvas.width/rect.width;
	    const y = (event.clientY - rect.top)*this.canvas.height/rect.height;

	    // Off-canvas
		if (( x < 0 ) || ( x > this.canvas.width ) || ( y < 0 ) || ( y > this.canvas.height) )
			return;

		// Find clicked-on RF
		var clickedRF = null;
		for ( var n = 0; n < this.RF.active.length; n++ ) {
			var dx = this.RF.x[n] - x;
			var dy = this.RF.y[n] - y;
			if ( (dx*dx + dy*dy) <= (this.RF.size[n]*this.RF.size[n]) ) {
				clickedRF = n;
			}
		}
		if ( clickedRF != null )
		{
			// Turn RF on
			if ( this.RF.active[clickedRF] == 0 ) {
				this.RF.active[clickedRF] = 1;
			} else if ( this.RF.active[clickedRF] == 1 ) {
				this.RF.active[clickedRF] = -1;
			} else if ( this.RF.active[clickedRF] == -1 ) {
				this.RF.active[clickedRF] = 0;
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
		//this.MUbar.MUs[3][0] = 1;
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

	this.uiStimNone = function() {
		//
		this.stimulus.stim_index = 0;
		this.stimulus.RFs = [];
		this.calcMUAPresponse();
	}

	this.uiStimEdge = function() {
		//
		this.stimulus.stim_index = 1;
		this.stimulus.RFs = [ 5, 6, 9, 14, 15, 10, 12 ];
		this.calcMUAPresponse();
	}

	this.uiStimEdge2 = function() {
		//
		this.stimulus.stim_index = 2;
		this.stimulus.RFs = [ 5, 9, 11, 14, 1, 15, 8, 2, 10 ];
		this.calcMUAPresponse();
	}

	this.uiStimPanel = function() {
		//
		this.stimulus.stim_index = 4;
		this.stimulus.RFs = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];
		this.calcMUAPresponse();
	}

	this.uiStimPoint = function() {
		//
		this.stimulus.stim_index = 3;
		this.stimulus.RFs = [ 5, 6, 9 ];
		this.calcMUAPresponse();
	}

	this.uiResetRFs = function() {
		//
		for ( var k = 0; k < this.RF.active.length; k++ ) {
			this.RF.active[k] = 0;
		}
		this.uiStimNone();
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

		// First, reset all MUbar elements to zero, then populate if both stimulus and RF are active
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
			//for ( var k = 0; k < this.MUbar.MUs.length; k++ ) {
				k=3;
				this.MUbar.MUs[k][n] = 0;
				this.neuron.dendrite[n].weight = 0;
				if ( this.RF.active[n] != 0 ) {
					// If RF is active, check if stim activates that RF
					for (var tk = 0; tk < this.stimulus.RFs.length; tk++ ) {
						if ( this.stimulus.RFs[tk] == (n+1) ) {
							this.MUbar.MUs[k][n] = 1;
							this.neuron.dendrite[n].weight = this.RF.active[n];
						}
					}
				}
			//}
		}
		
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



		// Draw RFs
		this.c.fillStyle = "rgba(0,0,0,0.5)";
		for ( var k = 0; k < this.RF.x.length; k++ ) {
			//
			this.c.beginPath();
			this.c.arc(this.RF.x[k],this.RF.y[k],this.RF.size[k],0,Math.PI*2,false);
			this.c.stroke();
			if ( this.RF.active[k] != 0 ) {
				if ( this.RF.active[k] == 1 )
					this.c.fillStyle = "rgba(0, 0, 0, 0.5)";
				if ( this.RF.active[k] == -1 )
					this.c.fillStyle = "rgba(150, 0, 0, 0.5)";
				this.c.fill();
				this.c.fillStyle = "white";
			}
			//
			if ( false ) {
				this.c.fillStyle = "black";
				this.c.fillText(k+1, this.RF.x[k],this.RF.y[k],this.RF.size[k]);
			}
		}
		this.c.fillStyle = "black";

		// Draw stimulus object
		this.c.save();
		switch ( this.stimulus.stim_index ) {
			case 0:
				// No stimulus
				break;
			case 1:
				// Edge
				this.c.beginPath();
				this.c.strokeStyle = "black";
				this.c.fillStyle = "rgba(0, 0, 255, 0.5)";
				this.c.fillRect( this.neuron.soma.x-45, 90, 40, this.canvas.height-140 );
				this.c.rect( this.neuron.soma.x-45, 90, 40, this.canvas.height-140 );
				this.c.fillStyle = "black";
				break;
			case 2:
				// Edge
				this.c.beginPath();
				this.c.strokeStyle = "black";
				this.c.fillStyle = "rgba(0, 0, 255, 0.5)";
				this.c.translate(this.neuron.soma.x-160, -100);
				this.c.rotate(30 * Math.PI / 180);
				this.c.fillRect( this.neuron.soma.x-45, 90, 40, this.canvas.height-140 );
				this.c.rect( this.neuron.soma.x-45, 90, 40, this.canvas.height-140 );
				this.c.fillStyle = "black";
				break;
			case 3:
				// Point
				this.c.beginPath();
				this.c.strokeStyle = "black";
				this.c.fillStyle = "rgba(255, 0, 0, 0.5)";
				this.c.arc(this.neuron.soma.x-32,159,5,0,Math.PI*2,false);
				this.c.fill();
				this.c.fillStyle = "black";
				break;
			case 4:
				// Flat panel
				this.c.beginPath();
				this.c.strokeStyle = "black";
				this.c.fillStyle = "rgba(0, 0, 255, 0.5)";
				this.c.fillRect( this.neuron.soma.x-150, 90, 200, this.canvas.height-140 );
				this.c.rect( this.neuron.soma.x-150, 90, 200, this.canvas.height-140 );
				this.c.fillStyle = "black";
				break;
			default:
		}
		this.c.restore();

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
			//this.c.moveTo(this.neuron.soma.x,this.neuron.soma.y);
			//this.c.lineTo(this.neuron.dendrite[k].x,this.neuron.dendrite[k].y);
			// Second box
			this.c.moveTo(box2x+this.neuron.soma.x,this.neuron.soma.y);
			this.c.lineTo(box2x+this.neuron.dendrite[k].x,this.neuron.dendrite[k].y);
			// Draw
			this.c.fill();
			this.c.stroke();
		}
		this.c.strokeStyle = this.colorStroke;

		// Draw second soma
		this.c.beginPath();
		this.c.fillStyle = "white";
		this.c.arc(box2x+this.neuron.soma.x,this.neuron.soma.y,26,0,Math.PI*2,false);
		this.c.fill();
		this.c.stroke();

		// Draw motor unit activators
		//var symbol = "";
		this.c.beginPath();
		this.c.fillStyle = "black";
		this.c.fillText(this.onScreenText, resscale*4, resscale*8);

		// Draw MUAP train
		var yscaling = 15.0;
		this.c.beginPath();
		this.c.strokeStyle = "black";
		this.c.lineWidth = 1;
		for ( var n = 0; n < this.MUbar.MUs[0].length; n++ ) {
			this.c.moveTo( box2x+this.MUbar.xoffset[n], this.MUbar.yoffset[n] );
			// Only include time-points past the MU activation time
			for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
				this.c.lineTo( box2x+this.MUbar.xoffset[n] + this.MUbar.xspacing[n]*tn*this.MUbar.dt[n], this.MUbar.yoffset[n] - this.RF.active[n]*yscaling*this.MUAPs.APs[tn][n] );
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

		// Labels
		this.c.fillStyle = "black";
		this.c.fillText("Receptive fields", this.neuron.soma.x-35, 80);
		this.c.fillText("Post-synaptic potentials /", box2x+this.neuron.soma.x-110, 80);
		this.c.fillText("Membrane potential", box2x+this.neuron.soma.x-70, 96);
		
	}
}



// *** Main code block ***

var latInhib = new LatInhib();

uiStimNone = function( ) {
	latInhib.uiStimNone();
}

uiStimEdge = function( ) {
	latInhib.uiStimEdge();
}

uiStimEdge2 = function( ) {
	latInhib.uiStimEdge2();
}

uiStimPanel = function( ) {
	latInhib.uiStimPanel();
}

uiStimPoint = function( ) {
	latInhib.uiStimPoint();
}

uiResetRFs = function( ) {
	latInhib.uiResetRFs();
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
