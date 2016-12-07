	var map,
	data_deputes,
	data_input_scrutins,
	svg_map,
	render_count = 0,
	color,
	groupesViz;

	var titre_scrutin = d3.select('#titre_scrutin');


	var map = d3.select("#map");
	var parseDate = d3.timeParse("%Y-%m-%d");
	var timeScale = d3.scaleTime();
	var bisectDate = d3.bisector(function(d) { return d.date; }).left;

	var svg_slider = d3.select("svg#slider"),
	margin_slider = {right: 50, left: 50},
	width_slider = +svg_slider.attr("width") - margin_slider.left - margin_slider.right,
	height_slider = +svg_slider.attr("height");


	var formatYearMonth = d3.timeFormat("%Y-%m");
	var formatDayMonthYear = d3.timeFormat("%d/%m/%Y");
	var getYear = d3.timeFormat("%Y");
	var tooltip = d3.select("#tooltip");


	var x = d3.scaleTime()
	.range([0, width_slider])
	.clamp(true);

	var typesVote = {
		abstentions: "Abstention",
		pours: "Pour",
		contres: "Contre",
		nonVotants: "Non-votant"
	};

	function colorVotes(vote){
		return {
			"Pour": "green",
			"Contre": "red",
			"Abstention": "grey",
			"Non-votant": "black"
		}[vote] || "white"
	}
	function colorGroupes(vote){
		return {
			"NI": "green",
			"GDR": "red",
			"SER": "#df65b0",
			"LR": "#08589e",
			"UDI": "#4eb3d3",
			"RRDP": "purple"
		}[vote] || "grey"
	}

	function parseList(d){ 
		return JSON.parse(d)
	}

	function suppress_article(d){
		return _.upperFirst(_.trim(d.replace(/^le /, "").replace(/^l'/, "").replace(/^la /, "")));
	}

	function loadGroupes() {
		groupesViz = true;
		loadData("ordinaire");
		$("#titre_scrutin").html("Composition des groupes à l'Assemblée Nationale")
	}

	function show_tooltip(d, x, y){

		var margin_bottom = +( parseInt(tooltip.style("height")) +  parseInt(tooltip.style("padding-bottom")) +  parseInt(tooltip.style("padding-top")));

		tooltip
		.style('position', 'absolute')
		.style("left", x + "px")
		.style("top", (y - margin_bottom) + "px")
		.classed('is-active', true)
		.html("<strong>" + d.nom + "</strong><br />"
			+ d.parti_ratt_financier);
	}


	function hide_tooltip(){
		tooltip
		.classed('is-active', false);

	}

	function loadData(name) {
		d3.select("svg#map_assemblee").remove()

		queue()
		.defer(d3.csv, "data/deputes.csv")
		.defer(d3.json, "data/exemple-scrutin-"+name+".json")
		.defer(d3.csv, "data/scrutins_tabular.csv")
		.await(make_svg);
	}

	loadGroupes();


	function handleVotes(deputes, data){
		if (!data) data = {};
		Object.keys(typesVote).forEach(function(typ){
			if (data[typ]) {
				if (data[typ] === "0") {
					data[typ] = {votant: []};
				} else if (!Array.isArray(data[typ].votant)) {
					data[typ].votant = [data[typ].votant];
				}
			}
			(data[typ] || {votant: []}).votant.forEach(function(vt) {
				deputes[vt.acteurRef.replace(/^PA/, '')].mandat = vt.mandatRef;
				deputes[vt.acteurRef.replace(/^PA/, '')].vote = typesVote[typ];
			});
		});
	}

	function attach_votes(data_scrutin, deputes) {
		data_scrutin.ventilationVotes.organe.groupes.groupe.forEach(function(g){
			var groupe = {
				id: g.organeRef,
				n_membres: g.nombreMembresGroupe,
				vote_majo: g.vote.positionMajoritaire,
				decompteVoix: g.vote.decompteVoix
			};
			handleVotes(deputes, g.vote.decompteNominatif);
		});
		handleVotes(deputes, data_scrutin.miseAuPoint);
	}


	function make_svg (error, data_deputes, data_scrutin, all_scrutins) {

		var deputes = {};
		data_deputes.forEach(function(d){
			deputes[d.id_an] = d;
		});
		attach_votes(data_scrutin, deputes);

		all_scrutins.forEach(function(d){

			d.date = parseDate(d.dateScrutin);
			d.year_month = formatYearMonth(d.date);
			d.year = +getYear(d.date);
			d.all_votes = parseList(d.all_votes);
			d.clean_title = suppress_article(d.libelle);

		})

		var all_scrutions_solennels = all_scrutins.filter(function(d){return d.type_vote == 'scrutin public solennel'});
		var date_extent = d3.extent(all_scrutions_solennels, function(d){ return d.date});

		timeScale.domain(date_extent);


		if (render_count < 1){
			insert_slider(all_scrutions_solennels, data_deputes, date_extent);
			insert_predictive_typing(all_scrutions_solennels, data_deputes);

			render_count = 1;
		}

		d3.xml("img/hemicycle-an.svg?a=1").mimeType("image/svg+xml").get(function(error, xml) {

			if (error) throw error;

			var imported_svg= xml.documentElement;

			map.node().appendChild(imported_svg);


			svg_map = d3.select('#map').select('svg')
			.attr('id', 'map_assemblee')
			.call(responsivefy);

    // Colorize seat
    for (i in data_deputes){

    	var d = data_deputes[i];	
    	var this_path = svg_map.select('path[place="' + d.place_en_hemicycle +  '"]');
    	this_path.datum(d);

    	this_path
    	.attr('fill', (groupesViz ? colorGroupes(d.groupe_sigle) : colorVotes(d.vote)))
    	.attr('id', 'id_' + d.place_en_hemicycle);

    	this_path
    	.on('mouseover', function(d){show_tooltip(d, d3.event.x, d3.event.y)})
    	.on('mouseout', function(d){hide_tooltip()});

    }

    var selectScrutin = d3.select('#select_scrutin');


    selectScrutin.selectAll('option')
    .data(all_scrutions_solennels)
    .enter()
    .append('option')
    .attr('value', function(d){ return d.numero})
    .text(function(d){ return d.titre});


// Click on the form submit button to fire request
$('#select_scrutin').change(function() {

	var this_srutin = $('#select_scrutin').val();
	var this_scrutin_data = all_scrutions_solennels.filter(function(d){ return d.numero == this_srutin});
	var this_scrutin_votes = this_scrutin_data[0].all_votes;
	var scrutin_title = this_scrutin_data[0].titre;

	data_deputes.forEach(function(d){

		d.vote = this_scrutin_votes['PA' + d.id_an]
	})

	changevote(data_deputes, scrutin_title);

})


});

	}

	function changevote(data_deputes, scrutin_title){

		for (i in data_deputes){
			var d = data_deputes[i];
			var this_path = svg_map.select('path[place="' + d.place_en_hemicycle +  '"]');

			this_path.datum(d);

			this_path
			.attr('fill', (function(d){return colorVotes(d.vote)}));
		}

		titre_scrutin.html(suppress_article(scrutin_title));
		titre_scrutin.style("min-height", parseInt(titre_scrutin.style("line-height")) *3 + "px");

	}


	function responsivefy(svg){

    // get container + svg aspect ratio
    var container = d3.select(svg.node().parentNode),
    width = parseInt(svg.style('width')),
    height = parseInt(svg.style("height")),
    aspect = width / height;

    
    // add viewBox and preserve aspectratio properties
    // call resize so that svg resizes on initial page load
    svg.attr("viewBox", "0 0 " + width + " " + height)
    .attr("preserveAspectRatio", "xMinYMid")
    .call(resize);
    
    // to register multiple listeners for the same event type
    d3.select(window).on("resize." + container.attr("id"), resize);
    
    
    function resize() {

    	var targetWidth = parseInt(container.style("width"));

    	svg.attr("width", targetWidth);
    	svg.attr("height", Math.round(targetWidth / aspect));

    }
}


function insert_slider(data, data_deputes, date_extent){


	x.domain(date_extent);

	var slider = svg_slider
	.call(responsivefy).append("g")
	.attr("class", "slider")
	.attr("transform", "translate(" + margin_slider.left + "," + height_slider / 2 + ")");


	slider.append("line")
	.attr("class", "track")
	.attr("x1", x.range()[0])
	.attr("x2", x.range()[1])
	.select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
	.attr("class", "track-inset")
	.select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
	.attr("class", "track-overlay")
	.call(d3.drag()
		.on("start.interrupt", function() { slider.interrupt(); })
		.on("start drag", function() { move_slider(x.invert(d3.event.x)); }));

	slider.insert("g", ".track-overlay")
	.attr("class", "ticks")
	.attr("transform", "translate(0," + 18 + ")")
	.selectAll("text")
	.data(x.ticks(10))
	.enter().append("text")
	.attr("x", x)
	.attr("text-anchor", "middle")
	.text(function(d) { return formatYearMonth(d); });


	var handle = slider.insert("circle", ".track-overlay")
	.attr("class", "handle")
	.attr("r", 9);

	function move_slider(h) {
		handle.attr("cx", x(h));

		var scrutin_index = bisectDate(data, h);

		var this_scrutin_votes = data[scrutin_index].all_votes;
		var scrutin_title = data[scrutin_index].titre;

		data_deputes.forEach(function(d){

			d.vote = this_scrutin_votes['PA' + d.id_an]
		})
		changevote(data_deputes, scrutin_title);



	}

}


function insert_predictive_typing(data_scrutins, data_deputes){


	console.log(data_scrutins);


// constructs the suggestion engine
var data_scrutins_ = new Bloodhound({
	datumTokenizer: Bloodhound.tokenizers.obj.whitespace('clean_title'),
	queryTokenizer: Bloodhound.tokenizers.whitespace,
  local: data_scrutins
});


$('#remote .typeahead').typeahead(null, {
	name: 'scrutins-solennels',
	source: data_scrutins_,
	display: 'clean_title',
  templates: {
  	empty: [
  	'<div class="empty-message">',
  	'Pas de résultat',
  	'</div>'
  	].join('\n'),
  }
});


$('#remote .typeahead').on(
{
	'typeahead:selected': function(e, datum) {


		var this_scrutin_votes = datum.all_votes;
		var scrutin_title = datum.titre;

		data_deputes.forEach(function(d){

			d.vote = this_scrutin_votes['PA' + d.id_an]
		})

		changevote(data_deputes, scrutin_title);

		d3.select('#initialize').html('<i class="material-icons material-icons--accent">cancel</i>');

	},
	'typeahead:autocompleted': function(e, datum) {
	}
});

d3.select('#initialize')
.on('click', function(d){
  d3.select('#initialize').html('');
  $('.typeahead').typeahead('val', '');
});




}