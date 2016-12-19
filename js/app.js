    var map,
        data_deputes,
        data_input_scrutins,
        svg_map,
        render_count = 0,
        color,
        groupesViz,
        all_scrutins_numbers,
        data_deputes_;

    var titre_scrutin = d3.select('#titre_scrutin');
    var date_scrutin = d3.select('#date_scrutin');
    var texte_scrutin = d3.select('#texte_scrutin');

    var map = d3.select("#map");
    var parseDate = d3.timeParse("%Y-%m-%d");
    var timeScale = d3.scaleTime();
    var bisectDate = d3.bisector(function(d) {
        return d.date;
    }).left;
    var bisectNumLeft = d3.bisector(function(d) {
        return d.numero;
    }).left;

    var svg_slider = d3.select("svg#slider"),
        margin_slider = {
            right: 50,
            left: 50
        },
        width_slider = +svg_slider.attr("width") - margin_slider.left - margin_slider.right,
        height_slider = +svg_slider.attr("height");


    var formatYearMonth = d3.timeFormat("%Y-%m");
    var formatDayMonthYear = d3.timeFormat("%d/%m/%Y");
    var getYear = d3.timeFormat("%Y");
    var tooltip = d3.select("#tooltip");

    var barScale = d3.scaleLinear().range([0, 70]);

    var colorBarScale = d3.scaleOrdinal().range(['#22dd22', '#dd2222']).domain(['oui', 'non']);


    var x = d3.scaleTime()
        .range([0, width_slider])
        .clamp(true);

    var typesVote = {
        abstentions: "Abstention",
        pours: "Pour",
        contres: "Contre",
        nonVotants: "Non-votant"
    };

    function colorVotes(vote) {
        return {
            "Pour": "green",
            "Contre": "red",
            "Abstention": "grey",
            "Non-votant": "black"
        }[vote] || "white"
    }

    function colorGroupes(groupe, rattachement) {
        return {
            "NI": rattachement == "Europe Écologie Les Verts" ? "green": rattachement == "Parti socialiste" ? "#df65b0" : "grey",
            "GDR": "red",
            "SER": "#df65b0",
            "LR": "#08589e",
            "UDI": "#4eb3d3",
            "RRDP": "purple"
        }[groupe] || "grey"
    }

    function parseList(d) {
        return JSON.parse(d)
    }

    function suppress_article(d) {
        return _.upperFirst(_.trim(d.replace(/^le /, "").replace(/^l'/, "").replace(/^la /, "")));
    }

    function loadGroupes() {
        groupesViz = true;
        loadData("ordinaire");
        $("#titre_scrutin").html("Composition des groupes à l'Assemblée Nationale");
        date_scrutin.html('');
    }

    function show_tooltip(d, x, y) {

        var margin_bottom = +(parseInt(tooltip.style("height")) + parseInt(tooltip.style("padding-bottom")) + parseInt(tooltip.style("padding-top")));
        if (margin_bottom < 200) {
            margin_bottom = 200
        }

        tooltip
            .style('position', 'absolute')
            .style("left", x + "px")
            .style("top", (y - margin_bottom) + "px")
            .classed('is-active', true)
            .html("<strong>" + d.nom + "</strong><br />" +
                d.parti_ratt_financier + "<br />" +
                '<img src="' + d.url_photo + '" />');

        if (($(window).width() < 700)) {

            var svg_bounds = d3.select("#map_assemblee").node().getBoundingClientRect();
            var width_tooltip = +(parseInt(tooltip.style("width")) + parseInt(tooltip.style("padding-left")) + parseInt(tooltip.style("padding-right")));

            tooltip
                .style("top", (+svg_bounds.bottom - margin_bottom) + "px")
                .style("left", Math.round(+svg_bounds.left + (svg_bounds.width - width_tooltip) / 2) + "px");

            tooltip
                .on('click', function() {
                    hide_tooltip()
                });

        }

    }

    function hide_tooltip() {
        tooltip
            .classed('is-active', false);

    }

    function loadData(name) {
        d3.select("svg#map_assemblee").remove()

        queue()
            .defer(d3.csv, "data/deputes.csv")
            .defer(d3.json, "data/exemple-scrutin-" + name + ".json")
            .defer(d3.csv, "data/scrutins_tabular.csv")
            .await(make_svg);
    }

    loadGroupes();

    function handleVotes(deputes, data) {
        if (!data) data = {};
        Object.keys(typesVote).forEach(function(typ) {
            if (data[typ]) {
                if (data[typ] === "0") {
                    data[typ] = {
                        votant: []
                    };
                } else if (!Array.isArray(data[typ].votant)) {
                    data[typ].votant = [data[typ].votant];
                }
            }
            (data[typ] || {
                votant: []
            }).votant.forEach(function(vt) {
                deputes[vt.acteurRef.replace(/^PA/, '')].mandat = vt.mandatRef;
                deputes[vt.acteurRef.replace(/^PA/, '')].vote = typesVote[typ];
            });
        });
    }

    function attach_votes(data_scrutin, deputes) {
        data_scrutin.ventilationVotes.organe.groupes.groupe.forEach(function(g) {
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

    function make_svg(error, data_deputes, data_scrutin, all_scrutins) {

        var head_url_photo = 'https://www.nosdeputes.fr/depute/photo/';
        var tail_url_photo = '/160';

        var deputes = {};
        data_deputes.forEach(function(d) {
            deputes[d.id_an] = d;
            d.url_photo = head_url_photo + d.slug + tail_url_photo;
            d.nom_complet = d.prenom + " " + d.nom_de_famille;
        });
        attach_votes(data_scrutin, deputes);

        data_deputes_ = data_deputes;


        all_scrutins.forEach(function(d) {

            d.date = parseDate(d.dateScrutin);
            d.year_month = formatYearMonth(d.date);
            d.year = +getYear(d.date);
            d.all_votes = parseList(d.all_votes);
            d.clean_title = suppress_article(d.libelle);
            d.numero = +d.numero;
            d.nombre_abstentions = +d.nombre_abstentions;
            d.nombre_contre = +d.nombre_contre;
            d.nombre_nonVotant = +d.nombre_nonVotant;
            d.nombre_pour = +d.nombre_pour;
            d.nombre_suffrages_exprimes = +d.nombre_suffrages_exprimes;
            d.nombre_suffrages_requis = +d.nombre_suffrages_requis;
            d.nombre_votants = +d.nombre_votants;

        })

        var all_scrutions_solennels = all_scrutins.filter(function(d) {
            return d.type_vote == 'scrutin public solennel' || d.type_vote == 'scrutin à la tribune'
        });
        var date_extent = d3.extent(all_scrutions_solennels, function(d) {
            return d.date
        });
        all_scrutins_numbers = all_scrutions_solennels.map(function(d) {
            return d.numero
        });

        timeScale.domain(date_extent);

        if (render_count < 1) {
            insert_slider(all_scrutions_solennels, data_deputes, date_extent);
            insert_predictive_typing(all_scrutions_solennels, data_deputes);

            render_count = 1;
        }

        d3.xml("img/hemicycle-an.svg?a=0").mimeType("image/svg+xml").get(function(error, xml) {

            if (error) throw error;

            var imported_svg = xml.documentElement;
            map.node().appendChild(imported_svg);


            svg_map = d3.select('#map').select('svg')
                .attr('id', 'map_assemblee')
                .call(responsivefy);

            var svg_height = parseInt(svg_map.style("height"));
            var svg_width = parseInt(svg_map.style("width"));

            var infobox = svg_map.append('g')
                .attr('id', 'infobox')
                .attr('transform', 'translate(730,0)');

            infobox
                .append('rect')
                .attr('id', 'border_rect')
                .attr('width', '146px')
                .attr('height', '100px')
                // .attr('rx', 10)
                // .attr('ry', 10)
                .attr('fill', 'white')
                .attr('stroke', '#ccc')
                .attr('stroke-width', '1px')
                .style('display', 'none');

            infobox.append('text')
                .attr('id', 'resultats_generaux')
                .attr('x', 30)
                .attr('y', 25);


            var resultats_bars = infobox.append('g')
                .attr('transform', 'translate(5, 40)')
                .attr('id', 'resultats_bars');

            var namebox = svg_map.append('g')
                .attr('id', 'namebox')
                .attr('transform', 'translate(10,0)')
                .style('display', 'none');

            namebox
                .append('rect')
                .attr('id', 'namebox_rect')
                .attr('width', '154px')
                .attr('height', '80px')
                .attr('fill', 'white')
                .attr('stroke', '#ddd')
                .attr('stroke-width', '1px')
                // .style('display', 'none')
            ;

            namebox.append('text')
                .attr('id', 'namebox_title')
                .attr('x', 10)
                .attr('y', 15)
                .text("ZOOM SUR ");

            namebox.append('text')
                .attr('id', 'namebox_name')
                .attr('x', 10)
                .attr('y', 35);

            namebox.append('text')
                .attr('id', 'namebox_vote')
                .attr('x', 10)
                .attr('y', 55);

            d3.select("#arrow_back").style('top', svg_height / 4 + "px");

            d3.select("#arrow_forward")
                .style('top', svg_height / 4 + "px")
                .style('left', svg_width * .9 + "px");


            // Colorize seat
            for (i in data_deputes) {

                var d = data_deputes[i];

                var this_path = svg_map.select('path[place="' + d.place_en_hemicycle + '"]');

                this_path.datum(d);

                this_path
                    .attr('fill', (groupesViz ? colorGroupes(d.groupe_sigle, d.parti_ratt_financier) : colorVotes(d.vote)))
                    .attr('id', 'id_' + d.place_en_hemicycle);

                this_path
                    .on('mouseover', function(d) {
                        show_tooltip(d, d3.event.x, d3.event.y)
                    })
                    .on('mouseout', function(d) {
                        hide_tooltip()
                    });

            }

        });

    }

    function changevote(data_deputes, data_scrutins, scrutin_title, scrutin_date, scrutin_numero) {

        var datum = data_scrutins.filter(function(d) {
            return d.numero == scrutin_numero
        })[0];


        for (i in data_deputes) {
            var d = data_deputes[i];
            var this_path = svg_map.select('path[place="' + d.place_en_hemicycle + '"]');

            this_path.datum(d);

            this_path
                .attr('fill', (function(d) {
                    return colorVotes(d.vote)
                }));

            if (this_path.node() != null) {
                if (this_path.classed("focused") == true) {
                    this_path
                        .attr('stroke', function(d) {
                            return colorVotes(d.vote)
                        });

                    d3.select('#namebox_vote')
                        .text(d.vote ? d.vote.toUpperCase() : "NC")
                        .attr('fill', colorVotes(d.vote) != "white" ? colorVotes(d.vote) : "black");
                }
            }

        }

        barScale.domain([0, +datum['nombre_suffrages_exprimes']]);

        var data_oui_non = [{
            'result': 'oui',
            'value': datum['nombre_pour']
        }, {
            'result': 'non',
            'value': datum['nombre_contre']
        }]

        // data_oui_non.sort(function(d){return d.value});
        data_oui_non.sort(function(a, b) {
            return d3.descending(a.value, b.value)
        });

        d3.select("#border_rect").style('display', 'initial');

        d3.select("#resultats_generaux")
            .text(datum['resultat'].toUpperCase())
            .attr('fill', datum['resultat'] == "adopté" ? "#22dd22" : "#dd2222")
            .style('font-weight', 500);

        var summary_results = d3.select('#resultats_bars').selectAll('g')
            .attr('transform', function(d, i) {
                return 'translate(0,' + i * 20 + ')'
            })
            .data(data_oui_non);

        var summary_results_g = summary_results
            .enter()
            .append('g')
            .attr('transform', function(d, i) {
                return 'translate(0,' + i * 20 + ')'
            });

        summary_results_g
            .append('rect')
            .attr('x', 35)
            .attr('width', function(d) {
                return barScale(d.value)
            })
            .attr('height', 15)
            .attr('fill', function(d) {
                return colorBarScale(d.result)
            })
            .merge(summary_results)
            .select('rect')
            .attr('width', function(d) {
                return barScale(d.value)
            })
            .attr('fill', function(d) {
                return colorBarScale(d.result)
            });

        summary_results_g
            .append('text')
            .attr('class', 'label')
            .attr('y', 12)
            .text(function(d) {
                return d.result
            })
            .merge(summary_results)
            .select('text.label')
            .text(function(d) {
                return d.result
            });

        summary_results_g
            .append('text')
            .attr('class', 'value')
            .attr('y', 12)
            .attr('x', function(d) {
                return 40 + barScale(d.value)
            })
            .text(function(d) {
                return d.value
            })
            .merge(summary_results)
            .select('text.value')
            .text(function(d) {
                return d.value
            })
            .attr('x', function(d) {
                return 40 + barScale(d.value)
            });

        summary_results.exit().remove();

        titre_scrutin.html(suppress_article(scrutin_title));
        date_scrutin.html('<button class="mdl-button mdl-js-button mdl-button--raised">' + formatDayMonthYear(scrutin_date) + '</button>');
        texte_scrutin.style("min-height", parseInt(titre_scrutin.style("line-height")) * 3 + parseInt(date_scrutin.style("height")) +
            parseInt(titre_scrutin.style("margin-bottom")) + parseInt(titre_scrutin.style("margin-top")) + "px");

        d3.select("#arrow_back")
            .style('display', 'block')
            .on('click', function() {
                next_vote(data_deputes, data_scrutins, scrutin_title, scrutin_date, 'back')
            });

        d3.select("#arrow_forward")
            .style('display', 'block')
            .on('click', function() {
                next_vote(data_deputes, data_scrutins, scrutin_title, scrutin_date, 'forward')
            });

    }

    function responsivefy(svg) {

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
            var targetHeight = Math.round(targetWidth / aspect);

            svg.attr("width", targetWidth);
            svg.attr("height", targetHeight);

            // d3.select("#arrow_back").style('bottom', Math.round(targetWidth / aspect)/4 + "px");
            d3.select("#arrow_back").style('top', targetHeight / 4 + "px");

            d3.select("#arrow_forward")
                .style('top', targetHeight / 4 + "px")
                .style('left', targetWidth * .9 + "px");

        }
    }

    function insert_slider(data, data_deputes, date_extent) {


        x.domain(date_extent);

        var slider = svg_slider
            .call(responsivefy).append("g")
            .attr("class", "slider")
            .attr("transform", "translate(" + margin_slider.left + "," + height_slider / 2 + ")");


        slider.append("line")
            .attr("class", "track")
            .attr("x1", x.range()[0])
            .attr("x2", x.range()[1])
            .select(function() {
                return this.parentNode.appendChild(this.cloneNode(true));
            })
            .attr("class", "track-inset")
            .select(function() {
                return this.parentNode.appendChild(this.cloneNode(true));
            })
            .attr("class", "track-overlay")
            .call(d3.drag()
                .on("start.interrupt", function() {
                    slider.interrupt();
                })
                .on("start drag", function() {
                    move_slider(x.invert(d3.event.x));
                }));

        slider.insert("g", ".track-overlay")
            .attr("class", "ticks")
            .attr("transform", "translate(0," + 18 + ")")
            .selectAll("text")
            .data(x.ticks(10))
            .enter().append("text")
            .attr("x", x)
            .attr("text-anchor", "middle")
            .text(function(d) {
                return formatYearMonth(d);
            });

        var handle = slider.insert("circle", ".track-overlay")
            .attr("class", "handle")
            .attr("r", 9);

        function move_slider(h) {

            handle.attr("cx", x(h));

            var scrutin_index = bisectDate(data, h);

            var this_scrutin_votes = data[scrutin_index].all_votes;
            var scrutin_title = data[scrutin_index].titre;

            data_deputes.forEach(function(d) {

                d.vote = this_scrutin_votes['PA' + d.id_an];
                d.numero = data[scrutin_index].numero;
            })
            changevote(data_deputes, data, scrutin_title, data[scrutin_index].date, data[scrutin_index].numero);

        }

    }

    function insert_predictive_typing(data_scrutins, data_deputes) {

        // constructs the suggestion engine
        var data_scrutins_ = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('clean_title'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            local: data_scrutins,
        });


        $('#predictive_typing_theme .typeahead').typeahead(null, {
            name: 'scrutins-solennels',
            source: data_scrutins_,
            display: 'clean_title',
            limit: 10,
            templates: {
                empty: [
                    '<div class="empty-message">',
                    'Pas de résultat',
                    '</div>'
                ].join('\n'),
            }
        });

        $('#predictive_typing_theme .typeahead').on({
            'typeahead:selected': function(e, datum) {


                var this_scrutin_votes = datum.all_votes;
                var scrutin_title = datum.titre;

                data_deputes.forEach(function(d) {

                    d.vote = this_scrutin_votes['PA' + d.id_an];
                    d.numero = datum.numero;
                })

                changevote(data_deputes, data_scrutins, scrutin_title, datum.date, datum.numero);

                d3.select('#initialize_input').html('<button class="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect">RESET ' +
                    '<i class="material-icons">cancel</i></button>');


                d3.select('svg#slider g.slider .handle').attr("cx", x(datum.date));

            },
            'typeahead:autocompleted': function(e, datum) {}
        });

        d3.select('#initialize_input')
            .on('click', function(d) {
                d3.select('#initialize_input').html('');
                $('.typeahead').typeahead('val', '');
            });


        var data_deputes_ = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('nom_complet'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            local: data_deputes,
        });


        $('#predictive_typing_person .typeahead').typeahead(null, {
            name: 'scrutins-solennels',
            source: data_deputes_,
            display: 'nom_complet',
            limit: 10,
            templates: {
                empty: [
                    '<div class="empty-message">',
                    'Pas de résultat',
                    '</div>'
                ].join('\n'),
            }
        });

        $('#predictive_typing_person .typeahead').on({
            'typeahead:selected': function(e, datum) {

                d3.select("#map_assemblee").selectAll('path')
                    .attr('stroke-width', '0.3')
                    .classed('focused', false);

                d3.select("#map_assemblee").select('#cercle_depute').remove();



                var this_path = d3.select("#map_assemblee").select('#id_' + datum.place_en_hemicycle);
                this_color = this_path.style('fill');
                var element_box = this_path.node().getBBox();
                var center_x_thispath = Math.round(element_box.x + element_box.width / 2);
                var center_y_thispath = Math.round(element_box.y + element_box.height / 2);
                var path_bounds = this_path.node().getBoundingClientRect();

                this_path.select(function() {
                    return this.parentNode.appendChild(this);
                });

                this_path
                    .attr('stroke', this_color)
                    .classed('focused', true);

                d3.select("#map_assemblee")
                    .append('circle')
                    .attr('id', 'cercle_depute')
                    .attr('cx', center_x_thispath)
                    .attr('cy', center_y_thispath)
                    .attr('r', '35px');

                d3.select("#namebox").style('display', 'block');

                d3.select('#namebox_name')
                    .text(datum.nom);

                d3.select('#namebox_vote')
                    .text(datum.vote ? datum.vote.toUpperCase() : "")
                    .attr('fill', colorVotes(datum.vote) != "white" ? colorVotes(datum.vote) : "black");;

                show_tooltip(datum, Math.round(path_bounds.right), Math.round(path_bounds.top));

            },
            'typeahead:autocompleted': function(e, datum) {}
        });

    }

    function next_vote(data_deputes, data_scrutins, scrutin_title, scrutin_date, next) {

        var numero = data_deputes[0].numero;
        var numero_index = _.findIndex(all_scrutins_numbers, function(d) {
            return d == numero;
        });

        if (next == 'back') {
            var numero_index_next = numero_index <= 0 ? 0 : numero_index - 1;
        } else {
            var numero_index_next = numero_index >= all_scrutins_numbers.length - 1 ? all_scrutins_numbers.length - 1 : numero_index + 1;
        }

        var datum = data_scrutins[numero_index_next];
        var this_scrutin_votes = datum.all_votes;
        var scrutin_title = datum.titre;

        data_deputes.forEach(function(d) {

            d.vote = this_scrutin_votes['PA' + d.id_an];
            d.numero = datum.numero;
        })

        changevote(data_deputes, data_scrutins, scrutin_title, datum.date, datum.numero);
        d3.select('svg#slider g.slider .handle').attr("cx", x(datum.date));

    }